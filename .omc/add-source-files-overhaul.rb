#!/usr/bin/env ruby
# Register new Swift files into MConnect + MConnectTests Xcode targets.
# Idempotent. Run after the 8-worker UI overhaul.

require 'xcodeproj'
require 'pathname'

PROJECT_PATH = File.expand_path('../packages/ios-app/MConnect.xcodeproj', __dir__)
IOS_APP_ROOT = File.expand_path('../packages/ios-app', __dir__)

APP_FILES = [
  'MConnect/Views/Terminal/Keyboard/ModifierAccessoryBar.swift',
  'MConnect/Views/Terminal/Keyboard/StickyModifier.swift',
  'MConnect/Views/Terminal/ConnectionBadge.swift',
  'MConnect/Views/Terminal/InputHintBanner.swift',
  'MConnect/Views/Terminal/FloatingActionBar.swift',
  'MConnect/Views/Terminal/FloatingActionItem.swift',
  'MConnect/Views/Terminal/SelectionMenu.swift',
  'MConnect/Views/Terminal/SwiftTermBridge+Selection.swift',
  'MConnect/Views/Terminal/ANSIStripper.swift',
  'MConnect/Views/Terminal/MarkdownAgentView.swift',
  'MConnect/Views/Terminal/MarkdownChunker.swift',
  'MConnect/Views/Hosts/QRScannerOverlay.swift',
  'MConnect/Services/Pairing/PairingPayload.swift',
  'MConnect/Services/Pairing/QRCodec.swift',
  'MConnect/Services/Vault/VaultStore.swift'
]

TEST_FILES = [
  'MConnectTests/Terminal/Keyboard/StickyModifierTests.swift',
  'MConnectTests/FloatingActionBarTests.swift',
  'MConnectTests/Terminal/SelectionMenuTests.swift',
  'MConnectTests/Terminal/ANSIStripperTests.swift',
  'MConnectTests/Terminal/MarkdownChunkerTests.swift',
  'MConnectTests/Pairing/QRCodecTests.swift',
  'MConnectTests/Vault/VaultStoreTests.swift',
  'MConnectTests/Agents/AgentDashboardViewModelTests.swift'
]

project = Xcodeproj::Project.open(PROJECT_PATH)

def add_files(project, target_name, group_root, files)
  target = project.targets.find { |t| t.name == target_name }
  abort "Target #{target_name} not found" unless target

  main_group = project.main_group[group_root]
  abort "Group #{group_root} not found" unless main_group

  files.each do |rel_path|
    full_path = File.join(IOS_APP_ROOT, rel_path)
    unless File.exist?(full_path)
      puts "[skip] #{rel_path}: file does not exist"
      next
    end

    existing_in_target = target.source_build_phase.files.any? { |bf|
      bf.file_ref&.real_path&.to_s == full_path
    }
    if existing_in_target
      puts "[skip] #{rel_path}: already in #{target_name}"
      next
    end

    components = rel_path.split('/')[1..-2]
    group = main_group
    components.each do |comp|
      sub = group.children.find { |c| c.is_a?(Xcodeproj::Project::Object::PBXGroup) && c.display_name == comp }
      unless sub
        sub = group.new_group(comp, comp)
        puts "[grp ] created group #{group_root}/#{components[0..components.index(comp)].join('/')}"
      end
      group = sub
    end

    filename = File.basename(rel_path)
    file_ref = group.children.find { |c|
      c.is_a?(Xcodeproj::Project::Object::PBXFileReference) && c.display_name == filename
    }
    unless file_ref
      file_ref = group.new_file(filename)
      puts "[ref ] created file ref for #{filename}"
    end

    target.add_file_references([file_ref])
    puts "[add ] #{rel_path} -> #{target_name}"
  end
end

add_files(project, 'MConnect', 'MConnect', APP_FILES)
add_files(project, 'MConnectTests', 'MConnectTests', TEST_FILES)

project.save
puts "Saved #{PROJECT_PATH}"
