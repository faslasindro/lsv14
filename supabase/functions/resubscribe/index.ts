import Stripe from "npm:stripe@18.4.0";
import { createClient } from "npm:@supabase/supabase-js@2.53.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface ResubscribeRequest {
  subscriptionId: string;
  paymentMethodId: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    // Get the user
    const {
      data: { user },
    } = await supabaseClient.auth.getUser();

    if (!user) {
      throw new Error('Unauthorized');
    }

    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
      apiVersion: '2023-10-16',
    });

    const { subscriptionId, paymentMethodId }: ResubscribeRequest = await req.json();

    console.log('🔄 Processing resubscription:', {
      userId: user.id,
      subscriptionId: subscriptionId.substring(0, 10) + '...',
      paymentMethodId: paymentMethodId.substring(0, 10) + '...'
    });

    // Validate that the subscription belongs to the user
    const { data: subscription, error: subError } = await supabaseClient
      .from('subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .eq('stripe_subscription_id', subscriptionId)
      .single();

    if (subError || !subscription) {
      throw new Error('Subscription not found or access denied');
    }

    // Update Stripe subscription to remove cancellation and set new default payment method
    const updatedSubscription = await stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: false,
      default_payment_method: paymentMethodId,
      metadata: {
        resubscribed_at: new Date().toISOString(),
        resubscribed_by: user.id
      }
    });

    console.log('✅ Stripe subscription updated:', {
      subscriptionId: updatedSubscription.id,
      cancelAtPeriodEnd: updatedSubscription.cancel_at_period_end,
      status: updatedSubscription.status,
      currentPeriodEnd: new Date(updatedSubscription.current_period_end * 1000).toISOString()
    });

    // Update our database to reflect the resubscription
    const { error: dbError } = await supabaseClient.rpc('resubscribe_subscription', {
      p_subscription_id: subscription.id,
      p_payment_method_id: paymentMethodId
    });

    if (dbError) {
      console.error('❌ Database update failed:', dbError);
      throw new Error(`Failed to update subscription in database: ${dbError.message}`);
    }

    console.log('✅ Resubscription completed successfully');

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Resubscription successful. Auto-renewal will activate at the end of your current billing period.',
        subscription: {
          id: updatedSubscription.id,
          cancel_at_period_end: updatedSubscription.cancel_at_period_end,
          current_period_end: new Date(updatedSubscription.current_period_end * 1000).toISOString()
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('❌ Error processing resubscription:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});