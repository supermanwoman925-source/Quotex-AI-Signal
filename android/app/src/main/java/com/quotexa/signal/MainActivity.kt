package com.quotex.signal

import android.app.Activity
import android.content.Intent
import android.media.projection.MediaProjectionManager
import android.os.Bundle
import android.view.Gravity
import android.view.ViewGroup
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView
import androidx.activity.result.ActivityResultLauncher
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity

class MainActivity : AppCompatActivity() {

    private lateinit var mediaProjectionManager: MediaProjectionManager
    private lateinit var screenCaptureLauncher: ActivityResultLauncher<Intent>
    private lateinit var statusText: TextView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        try {
            mediaProjectionManager =
                getSystemService(MEDIA_PROJECTION_SERVICE)
                        as MediaProjectionManager

            screenCaptureLauncher =
                registerForActivityResult(
                    ActivityResultContracts.StartActivityForResult()
                ) { result ->

                    if (result.resultCode == Activity.RESULT_OK) {
                        val dataIntent = result.data

                        if (dataIntent != null) {
                            val serviceIntent = Intent(
                                this,
                                com.quotexa.signal.ScreenCaptureService::class.java
                            )

                            serviceIntent.putExtra(
                                com.quotexa.signal.ScreenCaptureService.EXTRA_RESULT_CODE,
                                result.resultCode
                            )

                            serviceIntent.putExtra(
                                com.quotexa.signal.ScreenCaptureService.EXTRA_DATA,
                                dataIntent
                            )

                            startForegroundService(serviceIntent)

                            statusText.text = "Screen capture started"
                        } else {
                            statusText.text =
                                "Screen capture data not received"
                        }
                    } else {
                        statusText.text =
                            "Screen capture permission cancelled"
                    }
                }

            createScreen()

        } catch (e: Exception) {
            statusText = TextView(this)
            statusText.text =
                "Startup error:\n${e.javaClass.simpleName}\n${e.message}"
            statusText.textSize = 16f
            statusText.gravity = Gravity.CENTER
            setContentView(statusText)
        }
    }

    private fun createScreen() {

        val root = LinearLayout(this)
        root.orientation = LinearLayout.VERTICAL
        root.gravity = Gravity.CENTER
        root.setPadding(40, 40, 40, 40)

        val title = TextView(this)
        title.text = "Quotex AI Signal"
        title.textSize = 28f
        title.gravity = Gravity.CENTER

        root.addView(
            title,
            LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
            )
        )

        statusText = TextView(this)
        statusText.text = "Ready to capture screen"
        statusText.textSize = 18f
        statusText.gravity = Gravity.CENTER

        val statusParams = LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.WRAP_CONTENT
        )
        statusParams.topMargin = 40

        root.addView(statusText, statusParams)

        val startButton = Button(this)
        startButton.text = "START SCREEN CAPTURE"

        val buttonParams = LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.WRAP_CONTENT
        )
        buttonParams.topMargin = 40

        root.addView(startButton, buttonParams)

        startButton.setOnClickListener {
            statusText.text =
                "Requesting screen capture permission..."
            requestScreenCapture()
        }

        setContentView(root)
    }

    private fun requestScreenCapture() {
        val captureIntent =
            mediaProjectionManager.createScreenCaptureIntent()

        screenCaptureLauncher.launch(captureIntent)
    }
}
