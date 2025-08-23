const getBillingPeriodText = () => {
    if (!subscription?.subscription) return 'N/A';
    
    // Use database billing period text if available and accurate
    if (subscription.subscription.billing_period_text && subscription.subscription.billing_period_accurate !== false) {
      return subscription.subscription.billing_period_text;
    }
    
    // Enhanced fallback calculation for professional display
    const startDate = subscription.subscription.current_period_start;
    const endDate = subscription.subscription.current_period_end;
    const isCancelled = subscription.subscription.cancel_at_period_end;
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

  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showAddPaymentModal, setShowAddPaymentModal] = useState(false);
  const [showResubscribeModal, setShowResubscribeModal] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>('');
  const [resubscribeLoading, setResubscribeLoading] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  
  const { user } = useAuth();

  const handleResubscribe = async () => {
    if (!subscription?.subscription?.id || !selectedPaymentMethod) return;

    try {
      setResubscribeLoading(true);
      
      // Enable auto-renewal for the subscription without immediate charge
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/resubscribe`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          subscriptionId: subscription.subscription.stripe_subscription_id,
          paymentMethodId: selectedPaymentMethod
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to resubscribe');
      }
      
      // Update local subscription status
      await SubscriptionService.updateSubscriptionStatus(subscription.subscription.id, 'active');
      
      // Refresh billing data
      await loadBillingData();
      setShowResubscribeModal(false);
      setSelectedPaymentMethod('');
      
      // Show success message
      alert('Successfully resubscribed! Auto-renewal will activate at the end of your current billing period.');
      
    } catch (err: any) {
      setError(err.message || 'Failed to resubscribe');
    } finally {
      setResubscribeLoading(false);
    }
  };

  const handleAddPaymentMethodSuccess = async () => {

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

              {/* Action Buttons */}
              <div className="pt-4 border-t border-gray-200 space-y-3">
                {/* Cancelled Subscription Notice */}
                {subscription.subscription.cancel_at_period_end && !subscription.isExpired && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <Clock className="h-5 w-5 text-blue-600 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-blue-900 font-medium mb-1">Subscription Cancelled</p>
                        <p className="text-blue-800 text-sm mb-3">
                          You'll retain full access until {nextBillingInfo.text}. After that, your account will be downgraded to the free trial.
                        </p>
                        <button
                          onClick={() => setShowResubscribeModal(true)}
                          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors flex items-center gap-2"
                        >
                          <RefreshCw className="h-4 w-4" />
                          Resubscribe for Next Period
                        </button>
                      </div>
                    </div>
                      <div className="flex-1">
                        <p className="text-blue-900 font-medium mb-1">Subscription Cancelled</p>
                        <p className="text-blue-800 text-sm mb-3">
                          You'll retain full access until {nextBillingInfo.text}. After that, your account will be downgraded to the free trial.
                        </p>
                        <button
                          onClick={() => setShowResubscribeModal(true)}
                          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors flex items-center gap-2"
                        >
                          <RefreshCw className="h-4 w-4" />
                          Resubscribe for Next Period
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {subscription.isExpired && (

                {!subscription.subscription.cancel_at_period_end && !subscription.isExpired && subscription.subscription.plan_type !== 'trial' && (
                  <button
                    onClick={() => setShowCancelModal(true)}
                    className="w-full py-3 px-4 text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors text-sm font-medium"
                  >
                    Cancel Subscription
                  </button>

          </div>
        </div>
      )}

      {/* Resubscribe Modal */}
      {showResubscribeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-gray-900">Resubscribe to {getPlanDisplayName(subscription?.subscription?.plan_type || '')}</h3>
              <button
                onClick={() => {
                  setShowResubscribeModal(false);
                  setSelectedPaymentMethod('');
                }}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-blue-600 mt-0.5" />
                  <div>
                    <p className="font-medium text-blue-900 mb-1">How Resubscription Works</p>
                    <ul className="text-blue-800 text-sm space-y-1">
                      <li>• No immediate charge - you keep current access</li>
                      <li>• Auto-renewal activates at end of current period</li>
                      <li>• Billing resumes on {nextBillingInfo.text}</li>
                      <li>• Cancel anytime before renewal</li>
                    </ul>
                  </div>
                </div>
              </div>

              {paymentMethods.length === 0 ? (
                <div className="text-center py-6">
                  <CreditCard className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500 mb-4">No payment methods available</p>
                  <p className="text-sm text-gray-400 mb-4">Add a payment method to enable resubscription</p>
                  <button
                    onClick={() => {
                      setShowResubscribeModal(false);
                      setShowAddPaymentModal(true);
                    }}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Add Payment Method
                  </button>
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Select Payment Method for Future Billing
                  </label>
                  <div className="space-y-2">
                    {paymentMethods.map((method) => (
                      <label
                        key={method.id}
                        className={`flex items-center p-3 border rounded-lg cursor-pointer transition-colors ${
                          selectedPaymentMethod === method.id
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <input
                          type="radio"
                          name="paymentMethod"
                          value={method.id}
                          checked={selectedPaymentMethod === method.id}
                          onChange={(e) => setSelectedPaymentMethod(e.target.value)}
                          className="sr-only"
                        />
                        <div className="flex items-center gap-3 flex-1">
                          <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                            <CreditCard className="h-4 w-4 text-gray-600" />
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">
                              {method.card?.brand.toUpperCase()} •••• {method.card?.last4}
                            </p>
                            <p className="text-sm text-gray-600">
                              Expires {method.card?.exp_month}/{method.card?.exp_year}
                            </p>
                          </div>
                          {method.is_default && (
                            <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full font-medium">
                              Default
                            </span>
                          )}
                        </div>
                        {selectedPaymentMethod === method.id && (
                          <CheckCircle className="h-5 w-5 text-blue-600" />
                        )}
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {paymentMethods.length > 0 && (
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => {
                    setShowResubscribeModal(false);
                    setSelectedPaymentMethod('');
                  }}
                  className="flex-1 py-3 px-4 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleResubscribe}
                  disabled={!selectedPaymentMethod || resubscribeLoading}
                  className="flex-1 py-3 px-4 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {resubscribeLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <RefreshCw className="h-4 w-4" />
                      Enable Auto-Renewal
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
      {/* Resubscribe Modal */}
      {showResubscribeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-gray-900">Resubscribe to {getPlanDisplayName(subscription?.subscription?.plan_type || '')}</h3>
              <button
                onClick={() => {
                  setShowResubscribeModal(false);
                  setSelectedPaymentMethod('');
                }}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-blue-600 mt-0.5" />
                  <div>
                    <p className="font-medium text-blue-900 mb-1">How Resubscription Works</p>
                    <ul className="text-blue-800 text-sm space-y-1">
                      <li>• No immediate charge - you keep current access</li>
                      <li>• Auto-renewal activates at end of current period</li>
                      <li>• Billing resumes on {nextBillingInfo.text}</li>
                      <li>• Cancel anytime before renewal</li>
                    </ul>
                  </div>
                </div>
              </div>

              {paymentMethods.length === 0 ? (
                <div className="text-center py-6">
                  <CreditCard className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500 mb-4">No payment methods available</p>
                  <p className="text-sm text-gray-400 mb-4">Add a payment method to enable resubscription</p>
                  <button
                    onClick={() => {
                      setShowResubscribeModal(false);
                      setShowAddPaymentModal(true);
                    }}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Add Payment Method
                  </button>
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Select Payment Method for Future Billing
                  </label>
                  <div className="space-y-2">
                    {paymentMethods.map((method) => (
                      <label
                        key={method.id}
                        className={`flex items-center p-3 border rounded-lg cursor-pointer transition-colors ${
                          selectedPaymentMethod === method.id
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <input
                          type="radio"
                          name="paymentMethod"
                          value={method.id}
                          checked={selectedPaymentMethod === method.id}
                          onChange={(e) => setSelectedPaymentMethod(e.target.value)}
                          className="sr-only"
                        />
                        <div className="flex items-center gap-3 flex-1">
                          <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                            <CreditCard className="h-4 w-4 text-gray-600" />
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">
                              {method.card?.brand.toUpperCase()} •••• {method.card?.last4}
                            </p>
                            <p className="text-sm text-gray-600">
                              Expires {method.card?.exp_month}/{method.card?.exp_year}
                            </p>
                          </div>
                          {method.is_default && (
                            <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full font-medium">
                              Default
                            </span>
                          )}
                        </div>
                        {selectedPaymentMethod === method.id && (
                          <CheckCircle className="h-5 w-5 text-blue-600" />
                        )}
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {paymentMethods.length > 0 && (
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => {
                    setShowResubscribeModal(false);
                    setSelectedPaymentMethod('');
                  }}
                  className="flex-1 py-3 px-4 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleResubscribe}
                  disabled={!selectedPaymentMethod || resubscribeLoading}
                  className="flex-1 py-3 px-4 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {resubscribeLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <RefreshCw className="h-4 w-4" />
                      Enable Auto-Renewal
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};