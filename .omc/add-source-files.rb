#!/usr/bin/env ruby
# Register new Swift files into the MConnect Xcode target's Compile Sources.
# Idempotent.

require 'xcodeproj'
require 'pathname'

PROJECT_PATH = File.expand_path('../packages/ios-app/MConnect.xcodeproj', __dir__)
IOS_APP_ROOT = File.expand_path('../packages/ios-app', __dir__)
TARGET_NAME  = 'MConnect'

# Files relative to packages/ios-app/
FILES = [
  'MConnect/Views/Terminal/TerminalBuffer.swift',
  'MConnect/Views/Terminal/SwiftTermBridge.swift',
  'MConnect/Views/Screen/ScreenView.swift',
  'MConnect/Views/Screen/ScreenViewModel.swift',
  'MConnect/Views/Screen/VNCBridge.swift'
]

project = Xcodeproj::Project.open(PROJECT_PATH)
target  = project.targets.find { |t| t.name == TARGET_NAME }
abort "Target #{TARGET_NAME} not found" unless target

main_group = project.main_group['MConnect']
abort "MConnect group not found" unless main_group

FILES.each do |rel_path|
  full_path = File.join(IOS_APP_ROOT, rel_path)
  unless File.exist?(full_path)
    puts "[skip] #{rel_path}: file does not exist on disk"
    next
  end

  # Already in target?
  existing_in_target = target.source_build_phase.files.any? { |bf|
    bf.file_ref&.real_path&.to_s == full_path
  }
  if existing_in_target
    puts "[skip] #{rel_path}: already in target sources"
    next
  end

  # Walk/create groups for each path component under MConnect/
  components = rel_path.split('/')[1..-2]  # drop 'MConnect' prefix and the filename
  group = main_group
  components.each do |comp|
    sub = group.children.find { |c| c.is_a?(Xcodeproj::Project::Object::PBXGroup) && c.display_name == comp }
    unless sub
      sub = group.new_group(comp, comp)
      puts "[grp ] created group #{comp}"
    end
    group = sub
  end

  filename = File.basename(rel_path)
  # Already a file ref in this group?
  file_ref = group.children.find { |c|
    c.is_a?(Xcodeproj::Project::Object::PBXFileReference) && c.display_name == filename
  }
  unless file_ref
    file_ref = group.new_file(filename)
    puts "[ref ] created file ref for #{filename}"
  end

  target.add_file_references([file_ref])
  puts "[add ] #{rel_path}: added to MConnect target"
end

project.save
puts "Saved #{PROJECT_PATH}"
