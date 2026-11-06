// Run before Nitro's Node entry reads the listener configuration.
process.env.NITRO_PORT ??= process.env.PORT ?? '3410'
process.env.NITRO_HOST ||= process.env.HOST || '0.0.0.0'
