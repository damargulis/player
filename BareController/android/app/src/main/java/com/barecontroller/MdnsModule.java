
package com.barecontroller;

import android.content.Context;
import android.net.nsd.NsdManager;
import android.net.nsd.NsdServiceInfo;
import android.net.wifi.WifiManager;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.modules.core.DeviceEventManagerModule;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.bridge.Arguments;

public class MdnsModule extends ReactContextBaseJavaModule {
  private static final String SERVICE_TYPE = "_mymusic._tcp";
  private static final String SERVICE_NAME = "MyMusic";
  private static final int MAX_RESOLVE_ATTEMPTS = 3;

  private static ReactApplicationContext reactContext;
  private NsdManager.DiscoveryListener discoveryListener;
  private NsdManager nsdManager;
  private WifiManager.MulticastLock multicastLock;
  private boolean scanning = false;

  MdnsModule(ReactApplicationContext context) {
    super(context);
    reactContext = context;
  }

  @Override
  public String getName() {
    return "MdnsModule";
  }

  private void resolveWithRetry(final NsdServiceInfo service, final int attempt) {
    // NsdManager requires a fresh listener for every resolve call; reusing
    // one makes every resolve after the first fail silently.
    nsdManager.resolveService(service, new NsdManager.ResolveListener() {
      @Override
      public void onResolveFailed(NsdServiceInfo info, int errorCode) {
        if (attempt < MAX_RESOLVE_ATTEMPTS) {
          resolveWithRetry(service, attempt + 1);
        }
      }

      @Override
      public void onServiceResolved(NsdServiceInfo info) {
        WritableMap params = Arguments.createMap();
        params.putString("host", info.getHost().getHostAddress());
        params.putString("port", Integer.toString(info.getPort()));
        getReactApplicationContext().getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
          .emit("resolve", params);
      }
    });
  }

  @ReactMethod
  public void scan() {
    if (scanning) {
      return;
    }
    scanning = true;
    discoveryListener = new NsdManager.DiscoveryListener() {
      @Override public void onServiceFound(NsdServiceInfo service) {
        if (service.getServiceName().equals(SERVICE_NAME)) {
          resolveWithRetry(service, 1);
        }
      }
      @Override public void onDiscoveryStarted(String regType) {}
      @Override public void onServiceLost(NsdServiceInfo service) {}
      @Override public void onDiscoveryStopped(String s) {}
      @Override public void onStartDiscoveryFailed(String s, int i) { scanning = false; }
      @Override public void onStopDiscoveryFailed(String s, int i) {}
    };
    WifiManager wifi = (WifiManager) getReactApplicationContext().getApplicationContext()
      .getSystemService(Context.WIFI_SERVICE);
    multicastLock = wifi.createMulticastLock("multicastLock");
    multicastLock.setReferenceCounted(true);
    multicastLock.acquire();
    nsdManager = (NsdManager) getReactApplicationContext().getSystemService(Context.NSD_SERVICE);
    nsdManager.discoverServices(SERVICE_TYPE, NsdManager.PROTOCOL_DNS_SD, discoveryListener);
  }

  @ReactMethod
  public void stop() {
    if (!scanning) {
      return;
    }
    scanning = false;
    try {
      nsdManager.stopServiceDiscovery(discoveryListener);
    } catch (IllegalArgumentException err) {
      // discovery was not running; nothing to stop
    }
    if (multicastLock != null && multicastLock.isHeld()) {
      multicastLock.release();
    }
  }
}
