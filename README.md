# 🟢 NHAPP (WhatsApp Clone)

A fully functional, native Android WhatsApp clone built with modern Android development paradigms. This project demonstrates real-time bidirectional communication, secure backend integration, and a sleek Jetpack Compose user interface.

## 🚀 Features
*   **Real-time Messaging**: Instant text messaging powered by Supabase Realtime WebSockets.
*   **Secure Authentication**: Email/Password login securely tied to Postgres Row-Level Security (RLS) policies.
*   **Media Attachments**: High-resolution image sending with on-device compression and Supabase Storage integration.
*   **Profile Management**: Custom display names and avatar uploads synced across the cloud.
*   **Offline Push Notifications**: Integrated with Firebase Cloud Messaging (FCM) and Supabase Edge Functions to wake phones during incoming messages even when the app is completely killed.
*   **Message State**: "Soft-Deletes" ("Delete for Everyone" / "Delete for Me") and Read Receipts.
*   **Modern UI/UX**: Built 100% in Jetpack Compose mimicking the exact WhatsApp UX (Message bubbles, floating action buttons, tab layouts, and profile overlays).

## 🛠️ Technology Stack
### Frontend (Android)
*   **Language**: Kotlin
*   **UI Toolkit**: Jetpack Compose
*   **Architecture**: MVVM (Model-View-ViewModel)
*   **Concurrency**: Kotlin Coroutines & StateFlow
*   **Media Loading**: Coil AsyncImage

### Backend (Supabase/Firebase)
*   **Database**: PostgreSQL
*   **Authentication**: Supabase Auth
*   **Realtime**: Supabase Realtime subscriptions
*   **Storage**: Supabase Storage Buckets
*   **Serverless**: Supabase Edge Functions (Deno/TypeScript)
*   **Notifications**: Firebase Cloud Messaging (FCM) via Node.js Admin SDK

## 📐 Architecture Highlights
*   **Strict Security**: Uses Postgres RLS. Users can only fetch and update data (`Profiles`, `Chats`, `Messages`) that they explicitly own or participate in.
*   **Edge Functions**: The Firebase Service Account keys are never shipped in the Android APK. Instead, they are securely injected as environment variables into a hosted Supabase Edge Function that acts as a secure middleman proxy for push notifications.
*   **Asynchronous State**: The entire Compose UI is strictly driven by reactive `StateFlow` streams from the ViewModels, entirely decoupled from network latency (`ChatRepository.kt`).

## ⚙️ Local Development Setup

### 1. Supabase Initialization
1. Create a [Supabase Project](https://supabase.com).
2. Run the provided database queries in the `SQL Editor`:
   * `schema.sql`
   * `supabase_patch_profiles.sql`
   * `supabase_patch_storage.sql`
   * `supabase_trigger_fix.sql`
   * `supabase_notifications_trigger.sql`

### 2. Edge Functions (Push Notifications)
1. Install the Supabase CLI.
2. Link your local project: `supabase link --project-ref <YOUR_REF>`.
3. Set your Firebase Admin SDK secret:
   ```bash
   supabase secrets set FIREBASE_SERVICE_ACCOUNT='{...}'
   ```
4. Deploy the function: `supabase functions deploy push-notifications`

### 3. Android Android Build
1. Open `nhapp-android` in Android Studio.
2. Insert your `SUPABASE_URL` and `SUPABASE_ANON_KEY` inside `SupabaseSetup.kt`.
3. Drop your `google-services.json` (from Firebase Console) into the `app/` root directory.
4. Sync Gradle and hit **Install / Run**.

## 🛡️ License
This project is intended for educational purposes and academic presentation.
