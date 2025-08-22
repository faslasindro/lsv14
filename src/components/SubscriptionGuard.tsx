const getBillingPeriodText = () => {
    if (!subscription?.subscription) return 'N/A';
    
    // Use database billing period text if available and accurate
    if (subscription.subscription.billing_period_text && subscription.subscription.billing_period_accurate !== false) {
      return subscription.subscription.billing_period_text;
    }
    
    // Enhanced fallback calculation for professional display
    const startDate = subscription.subscription.current_period_start;
    const endDate = subscription.subscription.current_period_end;
    
    if (!startDate || !endDate) return 'N/A';
    
    const start = new Date(startDate);
    const end = new Date(endDate);
    const planType = subscription.subscription.plan_type;
    
    // Format dates professionally
    const startFormatted = start.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
    const endFormatted = end.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
    
    // Generate professional billing period text
    switch (planType) {
      case 'trial':
        return `${startFormatted} – ${endFormatted} (30-day trial)`;
      case 'monthly':
        return `Monthly billing (renews ${endFormatted})`;
      case 'semiannual':
        return `${startFormatted} – ${endFormatted} (6-month plan)`;
      case 'annual':
        return `${startFormatted} – ${endFormatted} (1-year plan)`;
      default:
        return `${startFormatted} – ${endFormatted}`;
    }
  };
@@ .. @@
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Billing Period</span>
                <span className={`font-semibold text-sm ${
                  subscription?.subscription?.billing_period_accurate === false 
                    ? 'text-red-600' 
                    : 'text-gray-900'
                }`}>
                  {getBillingPeriodText()}
                </span>
              </div>
              
              {subscription?.subscription?.billing_period_accurate === false && (
                <div className="flex items-center gap-2 mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <AlertCircle className="h-4 w-4 text-yellow-600" />
                  <span className="text-xs text-yellow-700">
                    Billing period calculation may be inaccurate. Contact support if needed.
                  </span>
                </div>
              )}