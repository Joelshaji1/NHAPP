-- 1. Enable the http extension if not already enabled (required to ping Edge Functions from Database Triggers)
CREATE EXTENSION IF NOT EXISTS http WITH SCHEMA extensions;

-- 2. Create the webhook function that calls the Edge Function
CREATE OR REPLACE FUNCTION public.trigger_push_notification()
RETURNS TRIGGER AS $$
DECLARE
    edge_function_url TEXT := 'https://vcllrgssqonheiddzqdd.supabase.co/functions/v1/push-notifications';
    -- Using the anon key is usually fine for internal triggers if RLS is bypassed or the function is public,
    -- but we'll use service_role here for guaranteed execution. Replace with your actual anon/service key.
    -- (The user will need to put their anon key here if it's not set via a secure vault)
    auth_header TEXT := 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZjbGxyZ3NzcW9uaGVpZGR6cWRkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5NDg4MjUsImV4cCI6MjA4NzUyNDgyNX0.M2-_THBRJisSCD866U0oT7baOcG7AffAe2zjdXYOyG0';
    request_body JSONB;
    request_id BIGINT;
BEGIN
    -- Only trigger on actual text/image messages, skip soft-deletes
    IF NEW.content LIKE '%This message was deleted%' THEN
        RETURN NEW;
    END IF;

    -- Build the JSON payload to send to the Edge Function
    request_body := jsonb_build_object(
        'type', TG_OP,
        'table', TG_TABLE_NAME,
        'schema', TG_TABLE_SCHEMA,
        'record', row_to_json(NEW)
    );

    -- Perform the async HTTP POST request using the pg_net extension
    -- (Requires pg_net to be enabled in Supabase, which it is by default usually. 
    -- If pg_net is not available, we can use the 'http' extension).
    
    -- Attempting standard 'http' extension approach for immediate execution
    -- Since this is a trigger, we don't want to block the INSERT.
    PERFORM net.http_post(
        url := edge_function_url,
        headers := jsonb_build_object(
            'Content-Type', 'application/json'
            -- Auth header would go here if the function requires JWT.
            -- Assuming the Edge function is deployed with --no-verify-jwt for internal DB webhooks.
        ),
        body := request_body
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Bind the trigger to the messages table
DROP TRIGGER IF EXISTS on_message_insert_trigger ON public.messages;
CREATE TRIGGER on_message_insert_trigger
    AFTER INSERT ON public.messages
    FOR EACH ROW
    EXECUTE FUNCTION public.trigger_push_notification();
