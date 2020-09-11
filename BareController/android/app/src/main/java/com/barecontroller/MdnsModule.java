
package com.barecontroller;

import android.content.Context;
import android.net.nsd.NsdManager;
import android.net.nsd.NsdServiceInfo;
import com.facebook.react.bridge.NativeModule;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.modules.core.DeviceEventManagerModule;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.bridge.Arguments;

import java.util.Map;
import java.util.HashMap;

public class MdnsModule extends ReactContextBaseJavaModule {
  private static ReactApplicationContext reactContext;
  private NsdManager.DiscoveryListener discoveryListener;
  private NsdManager nsdManager;
  private NsdManager.ResolveListener resolveListener;

  MdnsModule(ReactApplicationContext context) {
    super(context);
    reactContext = context;
  }

  @Override
  public String getName() {
    return "MdnsModule";
  }

  @ReactMethod
  public void scan() {
    resolveListener = new NsdManager.ResolveListener() {
      @Override
      public void onResolveFailed(NsdServiceInfo nsdServiceInfo, int i) {} 
      
      @Override public void onServiceResolved(NsdServiceInfo nsdServiceInfo) {
        WritableMap params = Arguments.createMap();
        params.putString("host", nsdServiceInfo.getHost().getHostAddress());
        params.putString("port", Integer.toString(nsdServiceInfo.getPort()));
        getReactApplicationContext().getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
          .emit("resolve", params);
      }
    }; 
    discoveryListener = new NsdManager.DiscoveryListener() {
      @Override public void onServiceFound(NsdServiceInfo service) {
        if (service.getServiceName().equals("MyMusic")) {
          nsdManager.resolveService(service, resolveListener);
        }
      } 
      @Override public void onDiscoveryStarted(String regType) {} 
      @Override public void onServiceLost(NsdServiceInfo service) {} 
      @Override public void onDiscoveryStopped(String s) {} 
      @Override public void onStartDiscoveryFailed(String s, int i) {} 
      @Override public void onStopDiscoveryFailed(String s, int i) {}
    }; 
    nsdManager = (NsdManager) getReactApplicationContext().getSystemService(Context.NSD_SERVICE);
    nsdManager.discoverServices("_http._tcp", NsdManager.PROTOCOL_DNS_SD, discoveryListener);
  }

  @ReactMethod
  public void stop() {
    nsdManager.stopServiceDiscovery(discoveryListener);
  }
}
