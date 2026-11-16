package com.promora.analytics;

/** Test-only bridge to the package-private CSV cell encoder. */
public final class ReportControllerTestAccess {
    private ReportControllerTestAccess() {}
    public static String cell(Object v) { return ReportController.cell(v); }
}
