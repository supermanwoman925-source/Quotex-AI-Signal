package com.quotexa.signal

import android.app.Activity
import android.content.Context
import android.media.projection.MediaProjectionManager
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier

class MainActivity : ComponentActivity() {

    private var scanStatus by mutableStateOf("Ready to scan")

    private val screenCaptureLauncher =
        registerForActivityResult(
            ActivityResultContracts.StartActivityForResult()
        ) { result ->

            if (result.resultCode == Activity.RESULT_OK && result.data != null) {
                scanStatus = "SCREEN CAPTURE ACTIVE"
            } else {
                scanStatus = "Screen capture cancelled"
            }
        }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        setContent {
            SignalHome(
                scanStatus = scanStatus,
                onScanClick = {
                    startScreenCapture()
                }
            )
        }
    }

    private fun startScreenCapture() {

        val mediaProjectionManager =
            getSystemService(
                Context.MEDIA_PROJECTION_SERVICE
            ) as MediaProjectionManager

        val captureIntent =
            mediaProjectionManager.createScreenCaptureIntent()

        screenCaptureLauncher.launch(captureIntent)
    }
}

@Composable
fun SignalHome(
    scanStatus: String,
    onScanClick: () -> Unit
) {
    MaterialTheme {

        Column(
            modifier = Modifier.fillMaxSize(),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {

            Text(
                text = "Quotex AI Signal"
            )

            Button(
                onClick = onScanClick
            ) {
                Text("SCAN CHART")
            }

            Text(
                text = scanStatus
            )
        }
    }
}
