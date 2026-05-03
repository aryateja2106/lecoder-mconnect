#!/usr/bin/env ruby
# Add SwiftTerm + RoyalVNCKit SPM packages to MConnect.xcodeproj
# Idempotent: re-running is a no-op.

require 'xcodeproj'

PROJECT_PATH = File.expand_path('../packages/ios-app/MConnect.xcodeproj', __dir__)
TARGET_NAME  = 'MConnect'

PACKAGES = [
  {
    name: 'SwiftTerm',
    url:  'https://github.com/migueldeicaza/SwiftTerm.git',
    requirement: { kind: 'upToNextMajorVersion', minimumVersion: '1.13.0' },
    product_name: 'SwiftTerm'
  },
  {
    # RoyalVNC pins cryptoswift to an unstable version — SPM forces consumers
    # onto branch mode. Track main; pin to a commit later for reproducibility.
    name: 'RoyalVNCKit',
    url:  'https://github.com/royalapplications/royalvnc.git',
    requirement: { kind: 'branch', branch: 'main' },
    product_name: 'RoyalVNCKit'
  }
]

project = Xcodeproj::Project.open(PROJECT_PATH)
target  = project.targets.find { |t| t.name == TARGET_NAME }
abort "Target #{TARGET_NAME} not found" unless target

PACKAGES.each do |pkg|
  existing = project.root_object.package_references.find { |ref| ref.repositoryURL == pkg[:url] }
  if existing
    pkg_ref = existing
    if pkg_ref.requirement != pkg[:requirement]
      pkg_ref.requirement = pkg[:requirement]
      puts "[upd ] #{pkg[:name]}: requirement updated to #{pkg[:requirement].inspect}"
    else
      puts "[skip] #{pkg[:name]}: already referenced with same requirement"
    end
  else
    pkg_ref = project.new(Xcodeproj::Project::Object::XCRemoteSwiftPackageReference)
    pkg_ref.repositoryURL = pkg[:url]
    pkg_ref.requirement   = pkg[:requirement]
    project.root_object.package_references << pkg_ref
    puts "[add ] #{pkg[:name]}: package reference created"
  end

  already_linked = target.package_product_dependencies.any? { |d| d.product_name == pkg[:product_name] }
  if already_linked
    puts "[skip] #{pkg[:name]}: product already linked to target"
  else
    product_dep = project.new(Xcodeproj::Project::Object::XCSwiftPackageProductDependency)
    product_dep.package      = pkg_ref
    product_dep.product_name = pkg[:product_name]
    target.package_product_dependencies << product_dep

    # Also add to "Frameworks" build phase via PBXBuildFile
    framework_phase = target.frameworks_build_phase
    build_file = project.new(Xcodeproj::Project::Object::PBXBuildFile)
    build_file.product_ref = product_dep
    framework_phase.files << build_file
    puts "[add ] #{pkg[:name]}: product linked to #{TARGET_NAME} target"
  end
end

project.save
puts "Saved #{PROJECT_PATH}"
