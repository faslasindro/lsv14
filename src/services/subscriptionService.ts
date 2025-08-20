@@ .. @@
   static async getUserSubscription(userId: string): Promise<Subscription | null> {
     try {
-      const { data, error: rpcError } = await supabase.rpc('get_subscription_with_periods', {
-        user_id_param: userId
-      });
-
-      if (rpcError) {
-        console.error('Error fetching subscription via RPC:', rpcError);
-        const { data: fallbackData, error: fallbackError } = await supabase
-          .from('subscriptions')
-          .select('*')
-          .eq('user_id', userId)
-          .order('created_at', { ascending: false })
-          .maybeSingle();
-        
-        if (fallbackError) {
-          console.error('Fallback query failed:', fallbackError);
-          return null;
-        }
-        return fallbackData;
-      }
-      
-      return data && data.length > 0 ? data[0] : null;
+      // Use direct query with proper billing period handling
+      const { data, error } = await supabase
+        .from('subscriptions')
+        .select('*')
+        .eq('user_id', userId)
+        .order('created_at', { ascending: false })
+        .maybeSingle();
+      
+      if (error) {
+        console.error('Error fetching subscription:', error);
+        return null;
+      }
+      
+      return data;
     } catch (error: any) {
       console.error('Error fetching user subscription:', error);
       return null;
@@ .. @@
     // Use database billing period text if available, otherwise generate fallback
     let billingPeriodText = subscription.billing_period_text;
-    let billingPeriodAccurate = subscription.billing_period_accurate;
+    let billingPeriodAccurate = subscription.billing_period_accurate ?? true;
     
     if (!billingPeriodText) {
       billingPeriodText = this.generateFallbackBillingPeriodText(subscription);
       billingPeriodAccurate = false; // Mark as inaccurate since it's a fallback
     }
@@ .. @@
   private static generateFallbackBillingPeriodText(subscription: Subscription): string {
-    const startDate = new Date(subscription.current_period_start);
-    const endDate = new Date(subscription.current_period_end);
-    const planDurationText = this.getPlanDurationText(subscription.plan_type);
-    return `${startDate.toLocaleDateString('en-US')} – ${endDate.toLocaleDateString('en-US')} (${planDurationText})`;
+    const startDate = new Date(subscription.current_period_start);
+    const endDate = new Date(subscription.current_period_end);
+    
+    const startFormatted = startDate.toLocaleDateString('en-US', { 
+      month: 'short', 
+      day: 'numeric', 
+      year: 'numeric' 
+    });
+    const endFormatted = endDate.toLocaleDateString('en-US', { 
+      month: 'short', 
+      day: 'numeric', 
+      year: 'numeric' 
+    });
+    
+    switch (subscription.plan_type) {
+      case 'trial':
+        return `${startFormatted} – ${endFormatted} (30-day trial)`;
+      case 'monthly':
+        return `Monthly billing (renews ${endFormatted})`;
+      case 'semiannual':
+        return `${startFormatted} – ${endFormatted} (6-month plan)`;
+      case 'annual':
+        return `${startFormatted} – ${endFormatted} (1-year plan)`;
+      default:
+        return `${startFormatted} – ${endFormatted}`;
+    }
   }