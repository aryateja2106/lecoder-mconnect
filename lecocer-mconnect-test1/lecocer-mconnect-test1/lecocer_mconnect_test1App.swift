//
//  lecocer_mconnect_test1App.swift
//  LeCoder MConnect
//
//  Created by Arya Teja Rudraraju on 2/9/26.
//

import SwiftUI

@main
struct MConnectApp: App {
    var body: some Scene {
        WindowGroup {
            ContentView()
                .preferredColorScheme(.dark)
                .onAppear {
                    NotificationManager.shared.requestPermission()
                }
        }
    }
}
