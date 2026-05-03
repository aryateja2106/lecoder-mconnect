#!/usr/bin/env ruby
# Walk packages/ios-app/MConnect/ and ensure every .swift file is registered
# in the MConnect target's Compile Sources build phase. Idempotent.

require 'xcodeproj'
require 'pathname'

PROJECT_PATH = File.expand_path('../packages/ios-app/MConnect.xcodeproj', __dir__)
IOS_APP_ROOT = File.expand_path('../packages/ios-app', __dir__)
TARGET_NAME  = 'MConnect'
SOURCE_ROOT  = File.join(IOS_APP_ROOT, 'MConnect')

# Skip: tests, build artifacts, hidden dirs
EXCLUDE_PATTERNS = [/\/Build\//, /\/DerivedData\//, /\/\.build\//]

project = Xcodeproj::Project.open(PROJECT_PATH)
target  = project.targets.find { |t| t.name == TARGET_NAME }
abort "Target #{TARGET_NAME} not found" unless target

main_group = project.main_group['MConnect']
abort "MConnect group not found" unless main_group

# Already-registered file paths
registered = target.source_build_phase.files.map { |bf| bf.file_ref&.real_path&.to_s }.compact.to_set

added_count = 0
skip_count  = 0

Dir.glob(File.join(SOURCE_ROOT, '**', '*.swift')).each do |full_path|
  next if EXCLUDE_PATTERNS.any? { |re| full_path =~ re }

  if registered.include?(full_path)
    skip_count += 1
    next
  end

  rel_path = Pathname.new(full_path).relative_path_from(Pathname.new(SOURCE_ROOT)).to_s
  components = rel_path.split('/')[0..-2]  # everything except filename
  filename = File.basename(rel_path)

  # Walk/create groups
  group = main_group
  components.each do |comp|
    sub = group.children.find { |c| c.is_a?(Xcodeproj::Project::Object::PBXGroup) && c.display_name == comp }
    unless sub
      sub = group.new_group(comp, comp)
      puts "[grp ] created group #{components[0..components.index(comp)].join('/')}"
    end
    group = sub
  end

  # Already a file ref?
  file_ref = group.children.find { |c|
    c.is_a?(Xcodeproj::Project::Object::PBXFileReference) && c.display_name == filename
  }
  unless file_ref
    file_ref = group.new_file(filename)
  end

  target.add_file_references([file_ref])
  added_count += 1
  puts "[add ] #{rel_path}"
end

project.save
puts "Saved. Added: #{added_count}. Already registered: #{skip_count}."
