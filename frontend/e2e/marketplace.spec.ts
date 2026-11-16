import { expect, test, type Browser, type Page } from '@playwright/test';

const stamp = Date.now().toString(36);
const PASSWORD = 'Passw0rd-123';
const advertiserEmail = `e2e-adv-${stamp}@example.com`;
const promoterEmail = `e2e-pro-${stamp}@example.com`;
const business = `E2E Bakery ${stamp}`;
const title = `E2E sourdough launch ${stamp}`;

async function session(browser: Browser) { const ctx = await browser.newContext(); return ctx.newPage(); }

async function register(page: Page, path: string, name: string, email: string) {
  await page.goto(path);
  await page.getByLabel('Full name').fill(name);
  await page.getByLabel('Email', { exact: false }).first().fill(email);
  await page.getByLabel('Password', { exact: false }).fill(PASSWORD);
  await page.getByLabel(/I am 18 or older/).check();
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByText('Verify your email address')).toBeVisible();
  // No mail server locally: the dev profile exposes the verification link after "Resend email".
  await page.getByRole('button', { name: 'Resend email' }).click();
  await page.getByRole('link', { name: 'open the verification link' }).click();
  await expect(page.getByText('Your email is verified')).toBeVisible();
}
async function login(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Log in' }).click();
}

test('advertiser, admin and promoter complete the marketplace flow end to end', async ({ browser }) => {
  const adv = await session(browser), admin = await session(browser), pro = await session(browser);

  await test.step('public site shows live backend data', async () => {
    await adv.goto('/');
    await expect(adv.getByRole('heading', { name: /Your Ideas Deserve to Be/ })).toBeVisible();
    await adv.getByRole('link', { name: 'Explore Opportunities' }).first().click();
    await expect(adv).toHaveURL(/\/campaigns/);
    await expect(adv.getByText(/\d+ campaigns?/).first()).toBeVisible();
    await adv.getByPlaceholder('Search campaigns, products or businesses').fill('zzzz-no-such-campaign');
    await adv.keyboard.press('Enter');
    await expect(adv.getByText('No campaigns match your search')).toBeVisible();
  });

  await test.step('advertiser registers, verifies email and completes profiles', async () => {
    await register(adv, '/register?as=advertiser', 'Esha Advertiser', advertiserEmail);
    await adv.goto('/dashboard/settings');
    await adv.getByLabel('Phone').fill('+91 98765 43210');
    await adv.getByLabel('City').fill('Pune');
    await adv.getByRole('button', { name: 'Save profile' }).click();
    await expect(adv.getByText('Profile saved')).toBeVisible();
    await adv.getByRole('tab', { name: 'Business profile' }).click();
    await adv.getByLabel('Business or brand name').fill(business);
    await adv.getByLabel('Category').selectOption({ label: 'Products & Stores' });
    await adv.getByLabel('Description').fill('A small-batch sourdough bakery created by the end-to-end test.');
    await adv.getByRole('button', { name: 'Create business profile' }).click();
    await expect(adv).toHaveURL(/\/dashboard\/advertiser$/);
  });

  let campaignUrl = '';
  await test.step('advertiser creates a campaign in the eight-step wizard and submits it', async () => {
    await adv.goto('/dashboard/advertiser/campaigns/new');
    await adv.getByRole('button', { name: 'Continue' }).click();
    await expect(adv.getByText('Use at least 5 characters')).toBeVisible(); // validation blocks an empty step
    await adv.getByLabel('Campaign title').fill(title);
    await adv.getByLabel('Description').fill('Help us launch our new sourdough range. We reward every verified visitor you send to the order page.');
    await adv.getByRole('button', { name: 'Continue' }).click();
    await adv.getByLabel('Category').selectOption({ label: 'Products & Stores' });
    await adv.getByRole('button', { name: 'Continue' }).click();
    await adv.getByLabel('Target audience').fill('Food lovers aged 22 to 45 in Pune and Mumbai.');
    await adv.getByRole('button', { name: 'Continue' }).click();
    await adv.getByLabel('Geography').fill('Maharashtra');
    await adv.getByRole('button', { name: 'Continue' }).click();
    await adv.getByLabel('Landing page URL').fill('https://example.com/sourdough');
    await adv.getByRole('button', { name: 'Continue' }).click();
    await adv.getByLabel('Promoter reward budget (₹)').fill('1000');
    await adv.getByRole('button', { name: 'Continue' }).click();
    await adv.getByLabel(/Reward per qualified click/).fill('250');
    await adv.getByLabel('Who can promote?').selectOption('OPEN');
    await adv.getByLabel('Promotion instructions').fill('Share an honest recommendation with your link.');
    await adv.getByRole('button', { name: 'Continue' }).click();
    await expect(adv.getByText('₹250 per qualified click').first()).toBeVisible();
    await adv.getByRole('button', { name: 'Submit for review' }).click();
    await expect(adv.getByText('In review')).toBeVisible();
    campaignUrl = adv.url();
  });

  await test.step('admin approves the campaign', async () => {
    await login(admin, 'admin@promora.dev', 'Promora@123');
    await expect(admin).toHaveURL(/\/admin$/);
    await expect(admin.getByText('Total users')).toBeVisible();
    await admin.goto('/admin/campaigns?status=PENDING_REVIEW');
    await admin.getByText(title).first().click();
    await admin.getByRole('button', { name: 'Approve', exact: true }).click();
    await admin.getByRole('dialog').getByRole('button', { name: 'Approve' }).click();
    await expect(admin.getByText('Done. The action was recorded in the audit log.')).toBeVisible();
    await expect(admin.getByText('Approved').first()).toBeVisible();
  });

  await test.step('advertiser funds the campaign through the sandbox payment and it goes live', async () => {
    await adv.goto(campaignUrl);
    await adv.getByRole('button', { name: 'Fund now' }).click();
    const dialog = adv.getByRole('dialog');
    await expect(dialog.getByText('Sandbox mode: no real money moves')).toBeVisible();
    await expect(dialog.getByText('₹1,177')).toBeVisible(); // 1000 + 15% fee + 18% GST on the fee, computed by the server
    await dialog.getByRole('button', { name: 'Simulate payment (sandbox)' }).click();
    await expect(adv.getByText('Payment confirmed. Your campaign is funded.')).toBeVisible();
    await expect(adv.getByText('Active').first()).toBeVisible();
  });

  let referralLink = '';
  await test.step('advertiser copies a referral link', async () => {
    await adv.goto('/dashboard/referrals');
    referralLink = await adv.getByLabel('Referral link').inputValue();
    expect(referralLink).toContain('/register?ref=');
  });

  let trackingUrl = '';
  await test.step('promoter signs up through the referral link, applies and receives a tracking link', async () => {
    const ref = new URL(referralLink).searchParams.get('ref')!;
    await register(pro, `/register?as=promoter&ref=${ref}`, 'Pavan Promoter', promoterEmail);
    await pro.goto('/dashboard/settings?tab=promoter');
    await pro.getByLabel('Display name').fill(`E2E Creator ${stamp}`);
    await pro.getByLabel('Total audience size').fill('4200');
    await pro.getByLabel('UPI ID for payouts').fill('pavan.e2e@upi');
    await pro.getByRole('button', { name: 'Create promoter profile' }).click();
    await expect(pro).toHaveURL(/\/dashboard\/promoter\/marketplace/);
    await pro.getByPlaceholder('Search campaigns, products or businesses').fill(title);
    await pro.keyboard.press('Enter');
    await pro.getByRole('link', { name: new RegExp(title) }).first().click();
    await pro.getByRole('button', { name: 'Apply to promote' }).click();
    const submit = pro.getByRole('dialog').getByRole('button', { name: 'Submit application' });
    await expect(submit).toBeDisabled(); // disclosure must be acknowledged first
    await pro.getByRole('dialog').getByRole('checkbox').check();
    await submit.click();
    await expect(pro.getByText('You are promoting this campaign')).toBeVisible();
    await pro.goto('/dashboard/promoter/campaigns');
    const linkText = await pro.locator('p.break-all').first().innerText();
    expect(linkText).toMatch(/\/r\/[A-Za-z0-9]{8}$/);
    trackingUrl = linkText.trim();
  });

  await test.step('a click on the tracking link is recorded and redirected; self-clicks are not paid', async () => {
    const code = trackingUrl.split('/r/')[1];
    const realBrowser = { 'User-Agent': 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36' };
    const res = await pro.request.get(`/r/${code}`, { maxRedirects: 0, headers: realBrowser });
    await pro.request.get(`/r/${code}`, { maxRedirects: 0 }); // headless automation user agent: filtered as a bot
    expect(res.status()).toBe(302);
    expect(res.headers().location).toContain('https://example.com/sourdough?utm_source=promora');
    // On one machine the visitor shares the promoter's network address, so the fraud filter records the click
    // but refuses to pay for it. Paid, qualified clicks from other addresses are covered by the backend tests.
    await adv.goto(campaignUrl);
    await expect(adv.getByText('Self click')).toBeVisible();
    await expect(adv.getByText('Bot', { exact: true })).toBeVisible();
    await pro.goto('/dashboard/promoter');
    await expect(pro.getByText('2 total clicks', { exact: false })).toBeVisible();
  });

  await test.step('referral is activated, flagged for same-network sign-up, and rewarded only after admin approval', async () => {
    await admin.goto('/admin/referrals');
    const row = admin.locator('tr', { hasText: promoterEmail });
    await expect(row.getByText('Activated')).toBeVisible();
    await expect(row.getByText(/Suspicious:/)).toBeVisible();
    await row.getByRole('button', { name: 'Approve' }).click();
    await admin.getByRole('dialog').getByRole('button', { name: 'Approve reward' }).click();
    await expect(admin.getByText('Done. The action was recorded in the audit log.')).toBeVisible();
    await adv.goto('/dashboard/referrals');
    await expect(adv.getByText('Credits earned').locator('..').locator('..')).toContainText('₹25');
    await adv.goto('/dashboard/notifications');
    await expect(adv.getByText('Referral reward approved')).toBeVisible();
  });

  await test.step('admin views analytics built from the recorded events and the audit log', async () => {
    await admin.goto('/admin/reports');
    await admin.getByLabel('Report').selectOption('events');
    await expect(admin.getByRole('table').getByText('campaign_approved')).toBeVisible();
    await expect(admin.getByRole('table').getByText('referral_activated')).toBeVisible();
    await admin.goto('/admin/audit');
    await expect(admin.getByText('Campaign approve').first()).toBeVisible();
  });

  await test.step('role restrictions hold in the interface and on the API', async () => {
    await pro.goto('/admin');
    await expect(pro).toHaveURL(/\/dashboard$/);
    await pro.goto('/dashboard/advertiser');
    await expect(pro).toHaveURL(/\/dashboard\/settings\?tab=business/);
    expect((await pro.request.get('/api/v1/admin/dashboard')).status()).toBe(401); // no bearer token
    const token = await pro.evaluate(async () => (await (await fetch('/api/v1/auth/refresh', { method: 'POST', credentials: 'include' })).json()).accessToken);
    expect((await pro.request.get('/api/v1/admin/dashboard', { headers: { Authorization: `Bearer ${token}` } })).status()).toBe(403);
    expect((await pro.request.get('/api/v1/advertiser/campaigns', { headers: { Authorization: `Bearer ${token}` } })).status()).toBe(403);
    const anon = await session(browser);
    await anon.goto('/dashboard');
    await expect(anon).toHaveURL(/\/login\?next=/);
  });

  await test.step('logout ends the session', async () => {
    await adv.getByRole('button', { name: 'Log out' }).click();
    await adv.goto('/dashboard');
    await expect(adv).toHaveURL(/\/login/);
  });
});

test('mobile navigation, pricing and legal pages work on a phone-sized screen', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  await page.goto('/');
  await page.getByRole('button', { name: 'Open menu' }).click();
  await page.getByRole('navigation', { name: 'Mobile' }).getByRole('link', { name: 'Pricing' }).click();
  await expect(page.getByRole('heading', { name: 'Simple pricing that follows your results' })).toBeVisible();
  await expect(page.getByText('₹499').first()).toBeVisible(); // plans come from the API
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  await page.goto('/privacy-policy');
  await expect(page.getByText('Template text pending legal review')).toBeVisible();
  await page.goto('/contact');
  await page.getByRole('button', { name: 'Send message' }).click();
  await expect(page.getByText('Enter your name')).toBeVisible();
});
