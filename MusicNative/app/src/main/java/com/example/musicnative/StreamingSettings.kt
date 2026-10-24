package com.example.musicnative

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.*
import androidx.compose.runtime.*
import androidx.compose.runtime.livedata.observeAsState
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.musicnative.components.PillButton
import com.example.musicnative.ui.theme.*
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

/** Service URL and device token. Entered by hand once; both come from the desktop setup. */
@Composable
fun StreamingSettingsScreen() {
    val context = LocalContext.current
    // show the override if there is one, otherwise leave the fields blank so the built-in
    // values are visibly the source rather than looking like something that was typed
    val builtIn = StreamingClient.isUsingBuiltInConfig(context)
    var url by remember { mutableStateOf(if (builtIn) "" else StreamingClient.baseUrl(context)) }
    var token by remember { mutableStateOf(if (builtIn) "" else StreamingClient.deviceToken(context)) }
    var saved by remember { mutableStateOf(false) }
    val status by StreamingClient.status.observeAsState("")
    val online by Connectivity.isOnline.observeAsState(false)
    val scope = rememberCoroutineScope()

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(20.dp)
    ) {
        Text("Cloud Library", color = TextPrimary, fontSize = 22.sp, fontWeight = FontWeight.Bold)
        Spacer(modifier = Modifier.height(4.dp))
        Text(
            if (online) "Online" else "Offline — Cloud Library is hidden",
            color = if (online) Success else Warning,
            fontSize = 13.sp,
        )
        Spacer(modifier = Modifier.height(12.dp))
        if (builtIn && StreamingClient.isConfigured(context)) {
            Card(
                shape = RoundedCornerShape(10.dp),
                backgroundColor = com.example.musicnative.ui.theme.Surface,
                elevation = 0.dp,
            ) {
                Text(
                    "Using the configuration built into this APK. Nothing to enter — leave " +
                        "these blank unless you want to point this device somewhere else.",
                    color = TextSecondary,
                    fontSize = 13.sp,
                    modifier = Modifier.padding(14.dp),
                )
            }
        }
        Spacer(modifier = Modifier.height(12.dp))

        OutlinedTextField(
            value = url,
            onValueChange = { url = it; saved = false },
            label = { Text(if (builtIn) "Service URL (override)" else "Service URL") },
            placeholder = { Text("https://…run.app") },
            singleLine = true,
            modifier = Modifier.fillMaxWidth(),
        )
        Spacer(modifier = Modifier.height(12.dp))
        OutlinedTextField(
            value = token,
            onValueChange = { token = it; saved = false },
            label = { Text(if (builtIn) "Device token (override)" else "Device token") },
            singleLine = true,
            modifier = Modifier.fillMaxWidth(),
        )
        Spacer(modifier = Modifier.height(16.dp))
        Row {
            PillButton(if (saved) "Saved" else "Save", filled = true) {
                StreamingClient.save(context, url, token)
                saved = true
            }
            Spacer(modifier = Modifier.width(10.dp))
            PillButton("Refresh catalog", filled = false) {
                StreamingClient.save(context, url, token)
                saved = true
                scope.launch {
                    withContext(Dispatchers.IO) { StreamingClient.refreshCatalog(context) }
                }
            }
        }
        if (status.isNotEmpty()) {
            Spacer(modifier = Modifier.height(14.dp))
            Card(
                shape = RoundedCornerShape(10.dp),
                backgroundColor = com.example.musicnative.ui.theme.Surface,
                elevation = 0.dp,
            ) {
                Text(
                    status,
                    color = TextSecondary,
                    fontSize = 13.sp,
                    modifier = Modifier.padding(14.dp),
                )
            }
        }
        Spacer(modifier = Modifier.height(20.dp))
        Text(
            "Synced tracks always play from the phone. The Cloud Library is only used for " +
                "tracks you have not synced, and only while online. Clearing a field above removes the " +
                "override and goes back to the built-in values.",
            color = TextSecondary,
            fontSize = 12.sp,
        )
    }
}
