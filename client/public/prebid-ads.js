// the buy-ondemand payment popup does not work with adblock enabled. try to detect if it is enabled and show a warning.
// according to stackoverflow, the name prebid-ads should trigger the adblocker to run
window.isAdblockerEnabled = false;
window.showOnlineOrderingAdblockWarning = false;