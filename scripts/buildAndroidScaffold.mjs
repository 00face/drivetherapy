#!/usr/bin/env node
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * [WO-118] Native Android Gradle & WebView Project Builder (`android/`)
 * Generates a self-contained Android Studio / Gradle project (`com.drivetherapy.studio`)
 * and syncs the compiled Vite `dist/` bundle into `android/app/src/main/assets/public/`.
 */

import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const distDir = path.join(root, 'dist');
const androidDir = path.join(root, 'android');
const appDir = path.join(androidDir, 'app');
const mainDir = path.join(appDir, 'src', 'main');
const javaDir = path.join(mainDir, 'java', 'com', 'drivetherapy', 'studio');
const resLayoutDir = path.join(mainDir, 'res', 'layout');
const resValuesDir = path.join(mainDir, 'res', 'values');
const assetsPublicDir = path.join(mainDir, 'assets', 'public');

fs.mkdirSync(javaDir, { recursive: true });
fs.mkdirSync(resLayoutDir, { recursive: true });
fs.mkdirSync(resValuesDir, { recursive: true });
fs.mkdirSync(assetsPublicDir, { recursive: true });

// 1. Root settings.gradle
fs.writeFileSync(
  path.join(androidDir, 'settings.gradle'),
  `rootProject.name = "DriveTherapy"\ninclude ':app'\n`,
  'utf8'
);

// 2. Root build.gradle
fs.writeFileSync(
  path.join(androidDir, 'build.gradle'),
  [
    'buildscript {',
    '    repositories {',
    '        google()',
    '        mavenCentral()',
    '    }',
    '    dependencies {',
    '        classpath "com.android.tools.build:gradle:8.5.2"',
    '    }',
    '}',
    'allprojects {',
    '    repositories {',
    '        google()',
    '        mavenCentral()',
    '    }',
    '}',
    '',
  ].join('\n'),
  'utf8'
);

// 3. gradle.properties
fs.writeFileSync(
  path.join(androidDir, 'gradle.properties'),
  [
    'org.gradle.jvmargs=-Xmx2048m -Dfile.encoding=UTF-8',
    'android.useAndroidX=true',
    'android.nonTransitiveRClass=true',
    '',
  ].join('\n'),
  'utf8'
);

// 4. app/build.gradle
fs.writeFileSync(
  path.join(appDir, 'build.gradle'),
  [
    'plugins {',
    '    id "com.android.application"',
    '}',
    '',
    'android {',
    '    namespace "com.drivetherapy.studio"',
    '    compileSdk 34',
    '',
    '    defaultConfig {',
    '        applicationId "com.drivetherapy.studio"',
    '        minSdk 26',
    '        targetSdk 34',
    '        versionCode 220',
    '        versionName "2.2.0"',
    '    }',
    '',
    '    buildTypes {',
    '        release {',
    '            minifyEnabled false',
    '        }',
    '    }',
    '    compileOptions {',
    '        sourceCompatibility JavaVersion.VERSION_17',
    '        targetCompatibility JavaVersion.VERSION_17',
    '    }',
    '}',
    '',
    'dependencies {',
    '    implementation "androidx.appcompat:appcompat:1.7.0"',
    '    implementation "androidx.webkit:webkit:1.11.0"',
    '}',
    '',
  ].join('\n'),
  'utf8'
);

// 5. AndroidManifest.xml
fs.writeFileSync(
  path.join(mainDir, 'AndroidManifest.xml'),
  [
    '<?xml version="1.0" encoding="utf-8"?>',
    '<manifest xmlns:android="http://schemas.android.com/apk/res/android">',
    '    <uses-permission android:name="android.permission.INTERNET" />',
    '    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />',
    '    <uses-permission android:name="android.permission.READ_MEDIA_IMAGES" />',
    '    <uses-permission android:name="android.permission.READ_MEDIA_VIDEO" />',
    '    <uses-permission android:name="android.permission.READ_MEDIA_AUDIO" />',
    '',
    '    <application',
    '        android:allowBackup="false"',
    '        android:hardwareAccelerated="true"',
    '        android:label="@string/app_name"',
    '        android:supportsRtl="true"',
    '        android:usesCleartextTraffic="true"',
    '        android:theme="@style/Theme.AppCompat.NoActionBar">',
    '        <activity',
    '            android:name=".MainActivity"',
    '            android:configChanges="orientation|keyboardHidden|keyboard|screenSize|locale|smallestScreenSize|screenLayout|uiMode"',
    '            android:exported="true"',
    '            android:launchMode="singleTask">',
    '            <intent-filter>',
    '                <action android:name="android.intent.action.MAIN" />',
    '                <category android:name="android.intent.category.LAUNCHER" />',
    '            </intent-filter>',
    '            <intent-filter>',
    '                <action android:name="android.intent.action.VIEW" />',
    '                <category android:name="android.intent.category.DEFAULT" />',
    '                <category android:name="android.intent.category.BROWSABLE" />',
    '                <data android:scheme="drivetherapy" android:host="oauth" />',
    '            </intent-filter>',
    '        </activity>',
    '    </application>',
    '</manifest>',
    '',
  ].join('\n'),
  'utf8'
);

// 6. res/values/strings.xml
fs.writeFileSync(
  path.join(resValuesDir, 'strings.xml'),
  [
    '<?xml version="1.0" encoding="utf-8"?>',
    '<resources>',
    '    <string name="app_name">Drive Therapy</string>',
    '</resources>',
    '',
  ].join('\n'),
  'utf8'
);

// 7. MainActivity.java (Hardware-accelerated WebView with IndexedDB, WebGL, DOMStorage & AssetLoader)
fs.writeFileSync(
  path.join(javaDir, 'MainActivity.java'),
  [
    'package com.drivetherapy.studio;',
    '',
    'import android.annotation.SuppressLint;',
    'import android.os.Bundle;',
    'import android.webkit.WebChromeClient;',
    'import android.webkit.WebResourceRequest;',
    'import android.webkit.WebResourceResponse;',
    'import android.webkit.WebSettings;',
    'import android.webkit.WebView;',
    'import android.webkit.WebViewClient;',
    'import androidx.appcompat.app.AppCompatActivity;',
    'import androidx.webkit.WebViewAssetLoader;',
    '',
    'public class MainActivity extends AppCompatActivity {',
    '    private WebView webView;',
    '',
    '    @SuppressLint("SetJavaScriptEnabled")',
    '    @Override',
    '    protected void onCreate(Bundle savedInstanceState) {',
    '        super.onCreate(savedInstanceState);',
    '        webView = new WebView(this);',
    '        setContentView(webView);',
    '',
    '        final WebViewAssetLoader assetLoader = new WebViewAssetLoader.Builder()',
    '            .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this))',
    '            .build();',
    '',
    '        WebSettings settings = webView.getSettings();',
    '        settings.setJavaScriptEnabled(true);',
    '        settings.setDomStorageEnabled(true);',
    '        settings.setDatabaseEnabled(true);',
    '        settings.setAllowFileAccess(true);',
    '        settings.setMediaPlaybackRequiresUserGesture(false);',
    '',
    '        webView.setWebChromeClient(new WebChromeClient());',
    '        webView.setWebViewClient(new WebViewClient() {',
    '            @Override',
    '            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {',
    '                return assetLoader.shouldInterceptRequest(request.getUrl());',
    '            }',
    '        });',
    '',
    '        webView.loadUrl("https://appassets.androidplatform.net/assets/public/index.html");',
    '    }',
    '',
    '    @Override',
    '    public void onBackPressed() {',
    '        if (webView != null && webView.canGoBack()) {',
    '            webView.goBack();',
    '        } else {',
    '            super.onBackPressed();',
    '        }',
    '    }',
    '}',
    '',
  ].join('\n'),
  'utf8'
);

// 8. Sync compiled dist/ assets into android/app/src/main/assets/public/ (excluding bulky sprite folders if needed, or full dist)
if (fs.existsSync(distDir)) {
  if (fs.existsSync(assetsPublicDir)) {
    fs.rmSync(assetsPublicDir, { recursive: true, force: true });
  }
  fs.cpSync(distDir, assetsPublicDir, { recursive: true });
  console.log(`[build:android] Synced production dist/ into ${assetsPublicDir}`);
}

console.log(`[build:android] Native Android Gradle project ready in ${androidDir}`);
