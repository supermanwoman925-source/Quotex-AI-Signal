package com.quotexa.signal

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Intent
import android.content.pm.ServiceInfo
import android.graphics.PixelFormat
import android.hardware.display.DisplayManager
import android.hardware.display.VirtualDisplay
import android.media.ImageReader
import android.media.projection.MediaProjection
import android.media.projection.MediaProjectionManager
import android.os.Build
import android.os.IBinder
import android.util.DisplayMetrics

class ScreenCaptureService : Service() {

    private var mediaProjection: MediaProjection? = null
    private var virtualDisplay: VirtualDisplay? = null
    private var imageReader: ImageReader? = null

    companion object {

        const val EXTRA_RESULT_CODE = "result_code"
        const val EXTRA_DATA = "data"

        private const val CHANNEL_ID = "screen_capture_channel"
        private const val NOTIFICATION_ID = 1001
    }

    override fun onCreate() {
        super.onCreate()

        createNotificationChannel()

        val notification = createNotification()

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(
                NOTIFICATION_ID,
                notification,
                ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PROJECTION
            )
        } else {
            startForeground(
                NOTIFICATION_ID,
                notification
            )
        }
    }

    override fun onStartCommand(
        intent: Intent?,
        flags: Int,
        startId: Int
    ): Int {

        if (intent == null) {
            stopSelf()
            return START_NOT_STICKY
        }

        val resultCode =
            intent.getIntExtra(
                EXTRA_RESULT_CODE,
                -1
            )

        val resultData =
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                intent.getParcelableExtra(
                    EXTRA_DATA,
                    Intent::class.java
                )
            } else {
                @Suppress("DEPRECATION")
                intent.getParcelableExtra(EXTRA_DATA)
            }

        if (resultCode == -1 || resultData == null) {
            stopSelf()
            return START_NOT_STICKY
        }

        startScreenCapture(
            resultCode,
            resultData
        )

        return START_STICKY
    }

    private fun startScreenCapture(
        resultCode: Int,
        resultData: Intent
    ) {

        if (mediaProjection != null) {
            return
        }

        val mediaProjectionManager =
            getSystemService(
                MEDIA_PROJECTION_SERVICE
            ) as MediaProjectionManager

        mediaProjection =
            mediaProjectionManager.getMediaProjection(
                resultCode,
                resultData
            )

        if (mediaProjection == null) {
            stopSelf()
            return
        }

        val metrics = DisplayMetrics()

        @Suppress("DEPRECATION")
        windowManager.defaultDisplay.getRealMetrics(metrics)

        val width = metrics.widthPixels
        val height = metrics.heightPixels
        val density = metrics.densityDpi

        imageReader =
            ImageReader.newInstance(
                width,
                height,
                PixelFormat.RGBA_8888,
                2
            )

        imageReader?.setOnImageAvailableListener(
            { reader ->

                val image =
                    reader.acquireLatestImage()

                if (image != null) {

                    try {

                        /*
                         * Screen frame received here.
                         *
                         * This is where the future chart-analysis
                         * engine will process the captured screen.
                         */

                    } finally {
                        image.close()
                    }
                }

            },
            null
        )

        virtualDisplay =
            mediaProjection?.createVirtualDisplay(
                "QuotexAIScreenCapture",
                width,
                height,
                density,
                DisplayManager.VIRTUAL_DISPLAY_FLAG_AUTO_MIRROR,
                imageReader?.surface,
                null,
                null
            )

        if (virtualDisplay == null) {
            stopSelf()
        }
    }

    private fun createNotificationChannel() {

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {

            val channel =
                NotificationChannel(
                    CHANNEL_ID,
                    "Screen Capture",
                    NotificationManager.IMPORTANCE_LOW
                )

            channel.description =
                "Screen capture service for Quotex AI Signal"

            val manager =
                getSystemService(
                    NotificationManager::class.java
                )

            manager.createNotificationChannel(
                channel
            )
        }
    }

    private fun createNotification(): Notification {

        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {

            Notification.Builder(
                this,
                CHANNEL_ID
            )
                .setContentTitle("Quotex AI Signal")
                .setContentText("Screen capture is running")
                .setSmallIcon(
                    android.R.drawable.ic_menu_view
                )
                .setOngoing(true)
                .build()

        } else {

            @Suppress("DEPRECATION")
            Notification.Builder(this)
                .setContentTitle("Quotex AI Signal")
                .setContentText("Screen capture is running")
                .setSmallIcon(
                    android.R.drawable.ic_menu_view
                )
                .setOngoing(true)
                .build()
        }
    }

    override fun onDestroy() {

        imageReader?.close()
        imageReader = null

        virtualDisplay?.release()
        virtualDisplay = null

        mediaProjection?.stop()
        mediaProjection = null

        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? {
        return null
    }
}
