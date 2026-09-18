# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /usr/local/Cellar/android-sdk/24.3.3/tools/proguard/proguard-android.txt
# You can edit the include path and order by changing the proguardFiles
# directive in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# React Native / Hermes, Expo modules (expo-modules-core, expo-video,
# expo-libvlc-player), Media3 and Reanimated all ship their own consumer keep
# rules, which R8 merges automatically. The rules below cover the two players
# this app depends on beyond that.

# libvlc is driven through JNI from org.videolan.libvlc; nothing may be
# stripped or renamed there.
-keep class org.videolan.libvlc.** { *; }
-dontwarn org.videolan.**

# react-native-video (Media3) ships no consumer rules of its own. Its view
# manager and module are referenced by generated code, but keep the package
# so Media3 reflection-based renderer/extractor lookups keep working.
-keep class com.brentvatne.** { *; }
-dontwarn com.brentvatne.**
