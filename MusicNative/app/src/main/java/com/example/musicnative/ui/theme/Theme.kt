package com.example.musicnative.ui.theme

import androidx.compose.material.MaterialTheme
import androidx.compose.material.darkColors
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

// The app commits to a single dark look regardless of the system setting.
private val AppColorPalette = darkColors(
    primary = Accent,
    primaryVariant = AccentDeep,
    secondary = Accent,
    background = Background,
    surface = Surface,
    onPrimary = Color.White,
    onSecondary = Color.White,
    onBackground = TextPrimary,
    onSurface = TextPrimary,
)

@Composable
fun MusicNativeTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colors = AppColorPalette,
        typography = Typography,
        shapes = Shapes,
        content = content
    )
}
