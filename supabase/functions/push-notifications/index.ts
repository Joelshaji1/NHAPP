import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
// @ts-ignore
import { create } from "https://deno.land/x/djwt@v2.9.1/mod.ts"

// 1. JWT Generation logic for Google OAuth2
async function getAccessToken(serviceAccount: any) {
    const jwtPayload = {
        iss: serviceAccount.client_email,
        sub: serviceAccount.client_email,
        aud: "https://oauth2.googleapis.com/token",
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
        scope: "https://www.googleapis.com/auth/firebase.messaging"
    }

    const keyStr = serviceAccount.private_key.replace(/\\n/g, '\n')

    // Create crypto key from PEM
    const pemHeader = "-----BEGIN PRIVATE KEY-----"
    const pemFooter = "-----END PRIVATE KEY-----"
    const pemContents = keyStr.substring(
        keyStr.indexOf(pemHeader) + pemHeader.length,
        keyStr.indexOf(pemFooter)
    ).replace(/\s/g, "")

    const binaryDer = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0))
    const key = await crypto.subtle.importKey(
        "pkcs8",
        binaryDer.buffer,
        { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
        false,
        ["sign"]
    )

    const jwt = await create({ alg: "RS256", typ: "JWT" }, jwtPayload, key)

    const response = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`
    })

    const data = await response.json()
    return data.access_token
}

serve(async (req) => {
    try {
        const { record } = await req.json()
        if (!record || !record.content) {
            return new Response("Not a message insert", { status: 200 })
        }

        const senderId = record.sender_id
        const chatId = record.chat_id
        const content = record.content

        // Skip soft-deletes
        if (content.includes("This message was deleted")) {
            return new Response("Ignored deleted message", { status: 200 })
        }

        // Initialize Supabase Client
        const supabase = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        // Find the sender profile
        const { data: senderProfile } = await supabase
            .from('profiles')
            .select('name')
            .eq('id', senderId)
            .single()

        // Find the recipient in the chat
        const { data: receivers } = await supabase
            .from('chat_members')
            .select('user_id')
            .eq('chat_id', chatId)
            .neq('user_id', senderId)

        if (!receivers || receivers.length === 0) return new Response("No recipients", { status: 200 })

        const recipientIds = receivers.map(r => r.user_id)

        // Find the specific FCM token for the recipient
        const { data: profiles } = await supabase
            .from('profiles')
            .select('fcm_token, name')
            .in('id', recipientIds)

        if (!profiles) throw new Error('Profiles not found')

        const fcmTokens = profiles.map(p => p.fcm_token).filter(t => t)
        if (fcmTokens.length === 0) return new Response("No tokens found", { status: 200 })

        // 3. Send via FCM (V1 API)
        const saData = Deno.env.get('FIREBASE_SERVICE_ACCOUNT') || '{}'
        const serviceAccount = JSON.parse(saData)
        const projectId = serviceAccount.project_id

        const accessToken = await getAccessToken(serviceAccount)

        const senderName = senderProfile?.name || "Someone"
        const displayContent = record.image_url ? "📷 Image" : content

        const fcmPromises = fcmTokens.map(async (token) => {
            const fcmResponse = await fetch(`https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${accessToken}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    message: {
                        token: token,
                        notification: {
                            title: `New message from ${senderName}`,
                            body: displayContent
                        },
                        data: {
                            chat_id: chatId
                        }
                    }
                })
            })

            const text = await fcmResponse.text()
            console.log(`FCM Response: ${fcmResponse.status} ${text}`)
            return fcmResponse.ok
        })

        await Promise.all(fcmPromises)

        return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json" } })

    } catch (error) {
        console.error(error)
        return new Response(JSON.stringify({ error: error.message }), { status: 400 })
    }
})
