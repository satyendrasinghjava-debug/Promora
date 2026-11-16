package com.promora.payout;

import com.promora.admin.SettingsService;
import com.promora.audit.AuditService;
import com.promora.commission.Commission;
import com.promora.commission.CommissionRepository;
import com.promora.common.ApiException;
import com.promora.notification.NotificationService;
import com.promora.payment.Transaction;
import com.promora.payment.TransactionRepository;
import com.promora.promoter.PromoterProfile;
import com.promora.promoter.PromoterProfileRepository;
import com.promora.security.AuthUser;
import com.promora.security.Current;
import com.promora.user.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Service
public class PayoutService {
    private final PayoutRequestRepository payouts;
    private final CommissionRepository commissions;
    private final PromoterProfileRepository promoters;
    private final TransactionRepository transactions;
    private final UserRepository users;
    private final SettingsService settings;
    private final NotificationService notifications;
    private final AuditService audit;

    public PayoutService(PayoutRequestRepository payouts, CommissionRepository commissions, PromoterProfileRepository promoters, TransactionRepository transactions,
                         UserRepository users, SettingsService settings, NotificationService notifications, AuditService audit) {
        this.payouts = payouts; this.commissions = commissions; this.promoters = promoters; this.transactions = transactions;
        this.users = users; this.settings = settings; this.notifications = notifications; this.audit = audit;
    }

    /**
     * Requests payout of every approved, unpaid commission. The balance is computed here from commission rows under a
     * row lock; the client never supplies an amount. Repeating the call with the same idempotency key returns the first result.
     */
    @Transactional
    public PayoutRequest request(String idempotencyKey) {
        AuthUser user = Current.user();
        Current.requireVerifiedEmail();
        PayoutRequest existing = payouts.findByPromoterUserIdAndIdempotencyKey(user.id(), idempotencyKey).orElse(null);
        if (existing != null) return existing;
        PromoterProfile profile = promoters.findByUserId(user.id()).orElseThrow(() -> ApiException.badRequest("NO_PROMOTER_PROFILE", "Create a promoter profile first"));
        if (profile.getUpiId() == null) throw ApiException.unprocessable("NO_PAYOUT_METHOD", "Add your UPI ID in your promoter profile first");
        users.lockById(user.id()); // serialises concurrent payout requests by the same promoter
        List<Commission> available = commissions.lockAvailable(user.id(), "APPROVED");
        long total = available.stream().mapToLong(Commission::getAmountPaise).sum();
        long minimum = settings.getLong("payout.minimum_paise", 20000);
        if (total < minimum)
            throw ApiException.unprocessable("BELOW_MINIMUM", "You need at least ₹" + (minimum / 100) + " in cleared earnings to request a payout");
        PayoutRequest p = new PayoutRequest();
        p.setPromoterUserId(user.id());
        p.setAmountPaise(total);
        p.setUpiId(profile.getUpiId());
        p.setIdempotencyKey(idempotencyKey);
        payouts.save(p);
        available.forEach(c -> { c.setPayoutRequestId(p.getId()); commissions.save(c); });
        notifications.notifyStaff("finance.manage", "ADMIN_ALERT", "Payout request", "₹" + (total / 100), "/admin/payouts");
        return p;
    }

    /** Admin workflow: approve, reject, or mark-paid (with the bank/UPI reference of the transfer made outside Promora). */
    @Transactional
    public PayoutRequest decide(UUID id, String action, String note, String reference) {
        AuthUser admin = Current.user();
        PayoutRequest p = payouts.lockById(id).orElseThrow(() -> ApiException.notFound("Payout request"));
        switch (action) {
            case "approve" -> {
                if (!"REQUESTED".equals(p.getStatus())) throw ApiException.conflict("INVALID_STATE", "Only requested payouts can be approved");
                p.setStatus("APPROVED");
            }
            case "reject" -> {
                if (!"REQUESTED".equals(p.getStatus()) && !"APPROVED".equals(p.getStatus())) throw ApiException.conflict("INVALID_STATE", "This payout can no longer be rejected");
                if (note == null || note.isBlank()) throw ApiException.unprocessable("REASON_REQUIRED", "Give a reason for rejecting the payout");
                p.setStatus("REJECTED");
                commissions.findByPayoutRequestId(p.getId()).forEach(c -> { c.setPayoutRequestId(null); commissions.save(c); });
                notifications.notify(p.getPromoterUserId(), "PAYOUT", "Payout request rejected", note, "/dashboard/promoter/earnings");
            }
            case "mark-paid" -> {
                if ("PAID".equals(p.getStatus())) return p; // idempotent
                if (!"APPROVED".equals(p.getStatus())) throw ApiException.conflict("INVALID_STATE", "Approve the payout before marking it paid");
                if (reference == null || reference.isBlank()) throw ApiException.unprocessable("REFERENCE_REQUIRED", "Enter the transfer reference");
                p.setStatus("PAID");
                p.setPaidReference(reference.trim());
                commissions.findByPayoutRequestId(p.getId()).forEach(c -> { c.setStatus("PAID"); commissions.save(c); });
                Transaction t = new Transaction();
                t.setUserId(p.getPromoterUserId());
                t.setType("PAYOUT");
                t.setAmountPaise(p.getAmountPaise());
                t.setBasePaise(p.getAmountPaise());
                t.setStatus("PAID");
                t.setProvider("manual");
                t.setIdempotencyKey("payout-" + p.getId());
                t.setReferenceId(p.getId());
                t.setDescription("Payout to " + p.getUpiId() + " (ref " + reference.trim() + ")");
                transactions.save(t);
                notifications.notify(p.getPromoterUserId(), "PAYOUT", "Payout sent", "₹" + (p.getAmountPaise() / 100) + " was sent to " + p.getUpiId() + ".", "/dashboard/promoter/earnings");
            }
            default -> throw ApiException.badRequest("BAD_ACTION", "Unknown action");
        }
        p.setAdminNote(note);
        p.setDecidedBy(admin.id());
        p.setDecidedAt(Instant.now());
        payouts.save(p);
        audit.log(admin, "PAYOUT_" + action.toUpperCase().replace('-', '_'), "PAYOUT", p.getId(), note);
        return p;
    }
}
