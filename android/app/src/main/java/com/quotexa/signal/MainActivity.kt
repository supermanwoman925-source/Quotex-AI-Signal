package com.quotex.signal

import android.app.Activity
import android.content.Intent
import android.media.projection.MediaProjectionManager
import android.os.Bundle
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView
import android.view.Gravity
import android.view.ViewGroup
import androidx.activity.result.ActivityResultLauncher
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity

class MainActivity : AppCompatActivity() {

    private lateinit var mediaProjectionManager: MediaProjectionManager

    private lateinit var screenCaptureLauncher:
        ActivityResultLauncher<Intent>

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

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
                            ScreenCaptureService::class.java
                        )

                        serviceIntent.putExtra(
                            ScreenCaptureService.EXTRA_RESULT_CODE,
                            result.resultCode
                        )

                        serviceIntent.putExtra(
                            ScreenCaptureService.EXTRA_DATA,
                            dataIntent
                        )

                        startForegroundService(serviceIntent)

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
    }

    private lateinit var statusText: TextView

    private fun createScreen() {

        val root = LinearLayout(this)

        root.orientation = LinearLayout.VERTICAL

        root.gravity = Gravity.CENTER

        root.setPadding(
            40,
            40,
            40,
            40
        )

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

        statusText.text =
            "Ready to capture screen"

        statusText.textSize = 18f

        statusText.gravity = Gravity.CENTER

        val statusParams =
            LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
            )

        statusParams.topMargin = 40

        root.addView(
            statusText,
            statusParams
        )

        val startButton = Button(this)

        startButton.text =
            "START SCREEN CAPTURE"

        val buttonParams =
            LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
            )

        buttonParams.topMargin = 40

        root.addView(
            startButton,
            buttonParams
        )

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

    override fun onDestroy() {

        super.onDestroy()
    }
}
