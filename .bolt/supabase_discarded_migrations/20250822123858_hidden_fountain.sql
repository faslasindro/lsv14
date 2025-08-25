/*
  # Add Resubscription System for Modern SaaS Flow

  1. Database Schema Updates
    - Add cancel_at_period_end column to track resubscription intent
    - Add scheduled_payment_method_id for future billing setup
    - Add will_renew computed column for easy status checking

  2. Resubscription Logic
    - Users retain access until billing period ends
    - Resubscription sets up auto-renewal for next cycle
    - No immediate charging during resubscription process

  3. Modern SaaS Flow
    - Remove persistent banners after cancellation
    - Professional resubscription options in billing page
    - Clear status indicators for subscription state
*/

-- Add columns for modern resubscription flow
DO $$
BEGIN
  -- Add cancel_at_period_end column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subscriptions' AND column_name = 'cancel_at_period_end'
  ) THEN
    ALTER TABLE subscriptions ADD COLUMN cancel_at_period_end boolean DEFAULT false;
  END IF;

  -- Add scheduled_payment_method_id for future billing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subscriptions' AND column_name = 'scheduled_payment_method_id'
  ) THEN
    ALTER TABLE subscriptions ADD COLUMN scheduled_payment_method_id text;
  END IF;

  -- Add will_renew computed column for easy status checking
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subscriptions' AND column_name = 'will_renew'
  ) THEN
    ALTER TABLE subscriptions ADD COLUMN will_renew boolean 
    DEFAULT ((status = 'active') AND (NOT COALESCE(cancel_at_period_end, false)));
  END IF;
END $$;

-- Create indexes for new columns
CREATE INDEX IF NOT EXISTS idx_subscriptions_cancel_at_period_end 
ON subscriptions(cancel_at_period_end) 
WHERE cancel_at_period_end = true;

CREATE INDEX IF NOT EXISTS idx_subscriptions_will_renew 
ON subscriptions(will_renew) 
WHERE will_renew = true;

-- Function to handle subscription cancellation (sets cancel_at_period_end)
CREATE OR REPLACE FUNCTION cancel_subscription_at_period_end(
  p_subscription_id uuid,
  p_cancel_reason text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE subscriptions
  SET 
    cancel_at_period_end = true,
    will_renew = false,
    updated_at = now()
  WHERE id = p_subscription_id;
  
  -- Log cancellation event
  INSERT INTO subscription_events (subscription_id, event_type, event_data)
  VALUES (
    p_subscription_id,
    'cancellation_scheduled',
    jsonb_build_object(
      'cancel_reason', p_cancel_reason,
      'cancelled_at', now(),
      'will_end_at', (SELECT current_period_end FROM subscriptions WHERE id = p_subscription_id)
    )
  );
END;
$$;

-- Function to resubscribe (enable auto-renewal for next period)
CREATE OR REPLACE FUNCTION resubscribe_subscription(
  p_subscription_id uuid,
  p_payment_method_id text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE subscriptions
  SET 
    cancel_at_period_end = false,
    will_renew = true,
    scheduled_payment_method_id = p_payment_method_id,
    updated_at = now()
  WHERE id = p_subscription_id;
  
  -- Log resubscription event
  INSERT INTO subscription_events (subscription_id, event_type, event_data)
  VALUES (
    p_subscription_id,
    'resubscription_scheduled',
    jsonb_build_object(
      'payment_method_id', p_payment_method_id,
      'resubscribed_at', now(),
      'will_renew_at', (SELECT current_period_end FROM subscriptions WHERE id = p_subscription_id)
    )
  );
END;
$$;

-- Function to get subscription status with resubscription info
CREATE OR REPLACE FUNCTION get_subscription_with_resubscription_status(p_user_id uuid)
RETURNS TABLE(
  id uuid,
  user_id uuid,
  plan_type subscription_plan_type,
  status subscription_status,
  stripe_subscription_id text,
  stripe_customer_id text,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean,
  will_renew boolean,
  scheduled_payment_method_id text,
  billing_period_text text,
  billing_period_accurate boolean,
  days_remaining integer,
  is_expired boolean,
  is_cancelled boolean,
  subscription_state text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.id,
    s.user_id,
    s.plan_type,
    s.status,
    s.stripe_subscription_id,
    s.stripe_customer_id,
    s.current_period_start,
    s.current_period_end,
    s.cancel_at_period_end,
    s.will_renew,
    s.scheduled_payment_method_id,
    s.billing_period_text,
    s.billing_period_accurate,
    GREATEST(0, EXTRACT(days FROM (s.current_period_end - now()))::integer) as days_remaining,
    (s.current_period_end <= now()) as is_expired,
    (s.status = 'cancelled' OR s.cancel_at_period_end = true) as is_cancelled,
    CASE 
      WHEN s.current_period_end <= now() THEN 'expired'
      WHEN s.cancel_at_period_end = true AND s.will_renew = false THEN 'cancelled_ending'
      WHEN s.cancel_at_period_end = true AND s.will_renew = true THEN 'resubscribed'
      WHEN s.status = 'active' AND s.will_renew = true THEN 'active'
      ELSE 'unknown'
    END as subscription_state
  FROM subscriptions s
  WHERE s.user_id = p_user_id
  ORDER BY s.created_at DESC
  LIMIT 1;
END;
$$;

-- Create subscription events table for tracking resubscription events
CREATE TABLE IF NOT EXISTS subscription_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid REFERENCES subscriptions(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  event_data jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- Enable RLS on subscription events
ALTER TABLE subscription_events ENABLE ROW LEVEL SECURITY;

-- Policy for subscription events
CREATE POLICY "Users can read their subscription events"
  ON subscription_events
  FOR SELECT
  TO authenticated
  USING (
    subscription_id IN (
      SELECT id FROM subscriptions WHERE user_id = auth.uid()
    )
  );

-- Update will_renew column for existing subscriptions
UPDATE subscriptions 
SET will_renew = (status = 'active' AND NOT COALESCE(cancel_at_period_end, false))
WHERE will_renew IS NULL;

-- Grant permissions
GRANT EXECUTE ON FUNCTION cancel_subscription_at_period_end(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION resubscribe_subscription(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION get_subscription_with_resubscription_status(uuid) TO authenticated;