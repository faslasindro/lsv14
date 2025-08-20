/*
  # Fix Billing Period Calculation System

  1. Database Functions
    - Add billing_period_text and billing_period_accurate columns to subscriptions
    - Create comprehensive billing period calculation function
    - Add trigger to auto-calculate billing periods on subscription changes

  2. Billing Period Logic
    - Trial: "30-day trial period"
    - Monthly: "Monthly billing (renews monthly)"
    - Semiannual: "6-month plan (expires on [date])"
    - Annual: "Annual plan (expires on [date])"

  3. Accuracy Validation
    - Check if actual period matches expected duration for plan type
    - Mark periods as accurate/inaccurate for troubleshooting
*/

-- Add billing period columns to subscriptions table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subscriptions' AND column_name = 'billing_period_text'
  ) THEN
    ALTER TABLE subscriptions ADD COLUMN billing_period_text text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subscriptions' AND column_name = 'billing_period_accurate'
  ) THEN
    ALTER TABLE subscriptions ADD COLUMN billing_period_accurate boolean DEFAULT true;
  END IF;
END $$;

-- Drop existing trigger and function to recreate properly
DROP TRIGGER IF EXISTS trigger_update_billing_period_text ON subscriptions;
DROP FUNCTION IF EXISTS update_billing_period_text();

-- Create enhanced billing period calculation function
CREATE OR REPLACE FUNCTION update_billing_period_text()
RETURNS TRIGGER AS $$
DECLARE
  period_text text;
  start_date date;
  end_date date;
  actual_duration_days integer;
  expected_duration_days integer;
  is_accurate boolean := true;
  plan_description text;
BEGIN
  -- Extract dates for calculation
  start_date := NEW.current_period_start::date;
  end_date := NEW.current_period_end::date;
  actual_duration_days := end_date - start_date;
  
  -- Generate professional billing period text based on plan type
  CASE NEW.plan_type
    WHEN 'trial' THEN
      expected_duration_days := 30;
      period_text := to_char(start_date, 'Mon DD, YYYY') || ' – ' || 
                    to_char(end_date, 'Mon DD, YYYY') || ' (30-day trial)';
      -- Check accuracy (28-32 days is acceptable for trial)
      is_accurate := actual_duration_days BETWEEN 28 AND 32;
      
    WHEN 'monthly' THEN
      expected_duration_days := 30; -- Approximate
      period_text := 'Monthly billing (renews ' || to_char(end_date, 'Mon DD, YYYY') || ')';
      -- Monthly can vary between 28-31 days depending on the month
      is_accurate := actual_duration_days BETWEEN 28 AND 31;
      
    WHEN 'semiannual' THEN
      expected_duration_days := 183; -- Approximate 6 months
      period_text := to_char(start_date, 'Mon DD, YYYY') || ' – ' || 
                    to_char(end_date, 'Mon DD, YYYY') || ' (6-month plan)';
      -- 6 months can vary between 180-186 days
      is_accurate := actual_duration_days BETWEEN 180 AND 186;
      
    WHEN 'annual' THEN
      expected_duration_days := 365; -- Approximate 1 year
      period_text := to_char(start_date, 'Mon DD, YYYY') || ' – ' || 
                    to_char(end_date, 'Mon DD, YYYY') || ' (1-year plan)';
      -- 1 year can vary between 365-366 days (leap year)
      is_accurate := actual_duration_days BETWEEN 365 AND 366;
      
    ELSE
      -- Unknown plan type
      period_text := to_char(start_date, 'Mon DD, YYYY') || ' – ' || 
                    to_char(end_date, 'Mon DD, YYYY') || ' (' || actual_duration_days || ' days)';
      is_accurate := true; -- Assume accurate for unknown types
  END CASE;
  
  -- Update the record with calculated values
  NEW.billing_period_text := period_text;
  NEW.billing_period_accurate := is_accurate;
  
  -- Log for debugging if period is inaccurate
  IF NOT is_accurate THEN
    RAISE NOTICE 'Inaccurate billing period for subscription %: expected ~% days, got % days', 
                 NEW.id, expected_duration_days, actual_duration_days;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger to auto-calculate billing periods
CREATE TRIGGER trigger_update_billing_period_text
  BEFORE INSERT OR UPDATE OF current_period_start, current_period_end, plan_type ON subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_billing_period_text();

-- Update existing subscriptions to calculate billing periods
UPDATE subscriptions 
SET updated_at = now()
WHERE billing_period_text IS NULL OR billing_period_accurate IS NULL;

-- Create function to manually fix billing periods for troubleshooting
CREATE OR REPLACE FUNCTION fix_subscription_billing_periods()
RETURNS TABLE(
  subscription_id uuid,
  plan_type subscription_plan_type,
  old_billing_text text,
  new_billing_text text,
  was_accurate boolean,
  now_accurate boolean
) AS $$
DECLARE
  sub_record record;
  old_text text;
  old_accurate boolean;
BEGIN
  FOR sub_record IN 
    SELECT * FROM subscriptions 
    ORDER BY created_at DESC
  LOOP
    -- Store old values
    old_text := sub_record.billing_period_text;
    old_accurate := sub_record.billing_period_accurate;
    
    -- Trigger recalculation by updating the record
    UPDATE subscriptions 
    SET updated_at = now()
    WHERE id = sub_record.id;
    
    -- Get updated values
    SELECT s.billing_period_text, s.billing_period_accurate
    INTO NEW.new_billing_text, NEW.now_accurate
    FROM subscriptions s
    WHERE s.id = sub_record.id;
    
    -- Return the comparison
    subscription_id := sub_record.id;
    plan_type := sub_record.plan_type;
    old_billing_text := old_text;
    was_accurate := old_accurate;
    
    RETURN NEXT;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add index for billing period queries
CREATE INDEX IF NOT EXISTS idx_subscriptions_billing_period_accurate 
ON subscriptions(billing_period_accurate) 
WHERE billing_period_accurate = false;