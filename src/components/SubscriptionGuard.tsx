@@ .. @@
   const [subscriptionData, setSubscriptionData] = useState<any>(null);
   const [loading, setLoading] = useState(true);
-  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
   const { user } = useAuth();
   const navigate = useNavigate();
 
@@ .. @@
       const data = await SubscriptionService.checkSubscriptionAccess(user.id);
       setSubscriptionData(data);
-
-      // Check if specific feature is required and not available
-      if (requiredFeature && !data.features[requiredFeature]) {
-        setShowUpgradeModal(true);
-      } else {
-        setShowUpgradeModal(false);
-      }
     } catch (error) {
       console.error('Error checking subscription:', error);
@@ .. @@
     };
   };
 
-  const handleUpgrade = () => {
-    navigate('/upgrade');
-  };
-
   if (loading) {
@@ .. @@
     );
   }
 
-  // Show upgrade modal if required feature is not available
-  if (showUpgradeModal && requiredFeature && !subscriptionData?.features[requiredFeature]) {
+  // Show upgrade modal if required feature is not available (only for expired subscriptions)
+  if (requiredFeature && !subscriptionData?.features[requiredFeature] && subscriptionData?.isExpired) {
     return (
       <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
@@ .. @@
             <button
               onClick={() => setShowUpgradeModal(false)}
-              className="flex-1 py-3 px-4 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors"
+              className="flex-1 py-3 px-4 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors"
             >
               Maybe Later
             </button>
             <button
-              onClick={handleUpgrade}
+              onClick={() => navigate('/upgrade')}
               className="flex-1 py-3 px-4 bg-gradient-to-r from-[#E6A85C] via-[#E85A9B] to-[#D946EF] text-white rounded-xl hover:shadow-lg transition-all duration-200 flex items-center justify-center gap-2"
             >
               Upgrade Now
@@ .. @@
     );
   }
 
-  // Show trial expiry warning
+  // Show trial expiry warning (only for active trials nearing expiration)
   if (subscriptionData?.hasAccess && 
       subscriptionData?.subscription?.plan_type === 'trial' && 
       subscriptionData?.daysRemaining !== undefined && 
-      subscriptionData?.daysRemaining <= 7) {
+      subscriptionData?.daysRemaining <= 7 &&
+      !subscriptionData?.isCancelled) {
     return (
       <div className="min-h-screen bg-gray-50">
@@ .. @@
             </div>
             <button
-              onClick={handleUpgrade}
+              onClick={() => navigate('/upgrade')}
               className="bg-white text-gray-900 px-4 py-2 rounded-lg font-medium hover:bg-gray-100 transition-colors flex items-center gap-2"
             >
               Upgrade Now
@@ .. @@
     );
   }
 
-  // Show expired subscription message only if truly expired (not just cancelled)
+  // Show expired subscription message only if truly expired
   if (subscriptionData && !subscriptionData.hasAccess && subscriptionData.isExpired) {
     return (
@@ .. @@
           <button
-            onClick={handleUpgrade}
+            onClick={() => navigate('/upgrade')}
             className="w-full py-3 px-4 bg-gradient-to-r from-[#E6A85C] via-[#E85A9B] to-[#D946EF] text-white rounded-xl hover:shadow-lg transition-all duration-200 flex items-center justify-center gap-2"
           >
-            Renew Subscription
+            Subscribe Again
             <ArrowRight className="h-4 w-4" />
           </button>
@@ .. @@
     );
   }
 
-  // Show cancelled but still active subscription notice
-  if (subscriptionData?.isCancelled && subscriptionData?.hasAccess && !subscriptionData?.isExpired) {
-    return (
-      <div className="min-h-screen bg-gray-50">
-        {/* Cancellation Notice Banner */}
-        <div className="bg-gradient-to-r from-orange-400 to-red-500 text-white p-4">
-          <div className="max-w-7xl mx-auto flex items-center justify-between">
-            <div className="flex items-center gap-3">
-              <AlertTriangle className="h-5 w-5" />
-              <span className="font-medium">
-                Subscription cancelled. Access continues until {new Date(subscriptionData.subscription.current_period_end).toLocaleDateString()}
-              </span>
-            </div>
-            <button
-              onClick={handleUpgrade}
-              className="bg-white text-gray-900 px-4 py-2 rounded-lg font-medium hover:bg-gray-100 transition-colors flex items-center gap-2"
-            >
-              Reactivate
-              <ArrowRight className="h-4 w-4" />
-            </button>
-          </div>
-        </div>
-        {children}
-      </div>
-    );
-  }
+  // No persistent banners for cancelled subscriptions - handle in billing page instead
 
   return <>{children}</>;
 };