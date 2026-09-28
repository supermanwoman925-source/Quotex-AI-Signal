package com.quotexa.signal

import android.app.Activity
import android.content.Context
import android.content.Intent
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

    private lateinit var mediaProjectionManager: MediaProjectionManager

    private var capturePermissionIntent: Intent? = null

    private val screenCaptureLauncher =
        registerForActivityResult(
            ActivityResultContracts.StartActivityForResult()
        ) { result ->

            if (result.resultCode == Activity.RESULT_OK && result.data != null) {

                capturePermissionIntent = result.data

                statusMessage = "Screen capture permission granted"

            } else {

                statusMessage = "Screen capture permission denied"
            }
        }

    companion object {
        var statusMessage by mutableStateOf("Ready to scan chart")
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        mediaProjectionManager =
            getSystemService(Context.MEDIA_PROJECTION_SERVICE)
                    as MediaProjectionManager

        setContent {
            MaterialTheme {
                SignalHome(
                    status = statusMessage,
                    onScanClick = {

                        if (capturePermissionIntent == null) {

                            val intent =
                                mediaProjectionManager.createScreenCaptureIntent()

                            screenCaptureLauncher.launch(intent)

                        } else {

                            statusMessage = "Screen capture is ready"
                        }
                    }
                )
            }
        }
    }
}

@Composable
fun SignalHome(
    status: String,
    onScanClick: () -> Unit
) {

    Column(
        modifier = Modifier.fillMaxSize(),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {

        Text(
            text = "Quotex AI Signal",
            style = MaterialTheme.typography.headlineSmall
        )

        Button(
            onClick = onScanClick
        ) {

            Text("SCAN CHART")
        }

        Text(
            text = status
        )
    }
}
