Jekyll::Hooks.register :site, :pre_render do |site, payload|
  config = site.config['hooks'] || {}
# config/initializers/opentelemetry.rb
  require 'opentelemetry/sdk'
  require 'opentelemetry/exporter/otlp'
  require 'opentelemetry/instrumentation/all'

  OpenTelemetry::SDK.configure do |c|
      c.use_all() # enables all instrumentation!
  end
end
