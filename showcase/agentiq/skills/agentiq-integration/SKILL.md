---
name: AgentIQ-integration
description: "Comprehensive guide for interacting with the AgentIQ API Integration Service, including endpoint schemas, credential vaulting, image uploads, and headless job execution."
---

# AgentIQ Integration Service Skill

This skill teaches agents how to programmatically execute headless fullstack deployments, UI generations, and API integrations using the AgentIQ backend.

## Authentication
All endpoints (except `/credentials` and `/credentials/predict`) require authentication via the `X-Integration-Key` header or `Authorization: Bearer <token>` header. The token must match `INTEGRATION_API_KEY` in the environment.

## 1. Image Uploads
Upload reference images or UI mockups to be used as context by the LLMs.
*   **Endpoint:** `POST /api/v1/integrations/upload-image`
*   **Content-Type:** `multipart/form-data`
*   **Body:** `file` (the image file; max 10MB; supported formats: jpg, jpeg, png, webp, gif)
*   **Response:**
    ```json
    {
      "url": "https://<supabase-project>.supabase.co/storage/v1/object/public/test/integration-images/..."
    }
    ```

## 2. Global Credential Requirements (Optional)
List all globally known environment variables that the system understands.
*   **Endpoint:** `GET /api/v1/integrations/credentials/requirements`
*   **Response:** `List[Dict[str, str]]` containing keys and descriptions.

## 3. Predict Required Credentials
Analyze a specific project and instruction set to dynamically predict exactly which third-party credentials (including Supabase, Stripe, Resend) will be required to execute the job successfully.
*   **Endpoint:** `POST /api/v1/integrations/credentials/predict`
*   **Body:**
    ```json
    {
      "projectId": "uuid",
      "instructions": "I need to add Stripe for payments and Resend for transactional emails."
    }
    ```
*   **Response:**
    ```json
    [
        {"key": "NEXT_PUBLIC_SUPABASE_URL", "description": "Required for Supabase"},
        {"key": "STRIPE_SECRET_KEY", "description": "Required for Stripe"},
        ...
    ]
    ```

## 4. Vault Credentials
Upload the required environment variables securely. This endpoint encrypts the values and returns a unique reference ID. **This step is strictly required before starting a job if the prediction endpoint returns required keys.**
*   **Endpoint:** `POST /api/v1/integrations/credentials`
*   **Note:** Authentication is explicitly disabled on this route for easier client bridging.
*   **Body:** Flat JSON dictionary mapping predicted keys to their actual secrets.
    ```json
    {
      "NEXT_PUBLIC_SUPABASE_URL": "https://...",
      "STRIPE_SECRET_KEY": "sk_test_..."
    }
    ```
*   **Response:**
    ```json
    {
      "credentials_id": "cred_a1b2c3d4",
      "expires_at": "2026-08-21T12:00:00.000Z"
    }
    ```

## 5. Start Integration Job
Fire off the headless LangGraph workflow to build, verify, and deploy the application.
*   **Endpoint:** `POST /api/v1/integrations/jobs/start`
*   **Body:**
    ```json
    {
      "offeringType": "API Integration",
      "credentials_id": "cred_a1b2c3d4",
      "requirements": {
        "projectId": "uuid",
        "instructions": "Add Stripe for payments...",
        "session_files": [
           {
             "source_url": "https://...",
             "filename": "mockup.png",
             "file_intent": "reference_only"
           }
        ]
      }
    }
    ```
*   **Response:**
    ```json
    {
      "status": "queued",
      "run_id": "uuid-for-job"
    }
    ```
*   **Note:** `offeringType` can also be `"Landing Page"` or `"Full Stack App"`.

## 6. Stream Job Progress (Optional)
If you wish to display real-time progress to a user, you can connect to the Server-Sent Events (SSE) stream.
*   **Endpoint:** `GET /api/v1/integrations/jobs/{run_id}/stream`
*   **Response:** `text/event-stream` returning Server-Sent Events.

## 7. Poll Job Status
Poll this endpoint to monitor completion if not using the stream. The job is fully asynchronous.
*   **Endpoint:** `GET /api/v1/integrations/jobs/{run_id}/status`
*   **Response:**
    ```json
    {
        "status": "completed", 
        "progress": "Job complete",
        "result": {
            "projectId": "uuid",
            "deploy_url": "https://vercel-preview.app",
            "github_url": "https://github.com/...",
            "status": "deployed",
            "build_verified": true
        },
        "error": null
    }
    ```
*   **Note:** The state transitions from `queued` -> `running` -> `completed` (or `failed`). When `completed`, `result` will contain the final URLs.

## Workflow Rules & Guardrails
1. **Never skip vaulting:** If the predictor returns ANY keys, you MUST call `POST /credentials` before `POST /jobs/start`.
2. **Missing required env vars error:** If a job fails with `Missing required env vars`, it means you failed to upload one of the keys returned by the prediction endpoint.
3. **Headless guarantees:** For `API Integration`, if the LLM hallucinates an unrequired environment variable (e.g., `APP_URL`), the backend will safely ignore it and continue deploying, guaranteeing a final GitHub push.
