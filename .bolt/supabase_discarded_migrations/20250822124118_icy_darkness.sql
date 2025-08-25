/*
  # Add Resubscription Support Fields

  1. Database Schema Updates
    - Add cancel_at_period_end field to track subscription cancellation intent
    - Add scheduled_payment_method_id for future billing setup
    - Add will_renew computed field for easy access to renewal status

  2. Indexes
    - Add indexes for better query performance on new fields

  3. Triggers
    - Update triggers to maintain data consistency
*/

-- Add new fields to subscriptions table for resubscription support
DO $$
BEGIN
  -- Add cancel_at_period_end field
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subscriptions' AND column_name = 'cancel_at_period_end'
  ) THEN
    ALTER TABLE subscriptions ADD COLUMN cancel_at_period_end boolean DEFAULT false;
  END IF;

  -- Add scheduled_payment_method_id field
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subscriptions' AND column_name = 'scheduled_payment_method_id'
  ) THEN
    ALTER TABLE subscriptions ADD COLUMN scheduled_payment_method_id text;
  END IF;

  -- Add will_renew computed field
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subscriptions' AND column_name = 'will_renew'
  ) THEN
    ALTER TABLE subscriptions ADD COLUMN will_renew boolean 
    GENERATED ALWAYS AS (
      status = 'active' AND NOT COALESCE(cancel_at_period_end, false)
    ) STORED;
  END IF;
END $$;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_subscriptions_cancel_at_period_end 
ON subscriptions(cancel_at_period_end) 
WHERE cancel_at_period_end = true;

CREATE INDEX IF NOT EXISTS idx_subscriptions_will_renew 
ON subscriptions(will_renew) 
WHERE will_renew = true;

-- Update existing cancelled subscriptions to set cancel_at_period_end
UPDATE subscriptions 
SET cancel_at_period_end = true 
WHERE status = 'cancelled' AND cancel_at_period_end IS NULL;

-- Function to handle subscription cancellation (sets cancel_at_period_end instead of immediate cancellation)
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
    updated_at = now()
  WHERE id = p_subscription_id;
  
  -- Log cancellation reason if provided
  IF p_cancel_reason IS NOT NULL THEN
    INSERT INTO subscription_events (subscription_id, event_type, event_data)
    VALUES (p_subscription_id, 'cancellation_scheduled', jsonb_build_object('reason', p_cancel_reason));
  END IF;
END;
$$;

-- Function to resubscribe (removes cancel_at_period_end flag)
CREATE OR REPLACE FUNCTION resubscribe_subscription(
  p_subscription_id uuid,
  p_payment_method_id text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE subscriptions
  SET 
    cancel_at_period_end = false,
    scheduled_payment_method_id = p_payment_method_id,
    updated_at = now()
  WHERE id = p_subscription_id;
  
  -- Log resubscription event
  INSERT INTO subscription_events (subscription_id, event_type, event_data)
  VALUES (p_subscription_id, 'resubscribed', jsonb_build_object('payment_method_id', p_payment_method_id));
END;
$$;

-- Create subscription_events table for audit trail
CREATE TABLE IF NOT EXISTS subscription_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid REFERENCES subscriptions(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  event_data jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- Enable RLS on subscription_events
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

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION cancel_subscription_at_period_end(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION resubscribe_subscription(uuid, text) TO authenticated;