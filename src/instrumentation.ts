// Runs once when the Next.js server boots
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { APP_ENV, isProdEnv, checkAppConfig } = await import('./lib/appEnv');
    const problems = checkAppConfig();
    console.log(`app env: ${APP_ENV}`);
    if (problems.length > 0) {
      const msg = `config problems (${APP_ENV}):\n  - ${problems.join('\n  - ')}`;
      // A half-configured production server would take real money with broken secrets — refuse to start
      if (isProdEnv) throw new Error(msg);
      console.warn(msg);
    }

    const { startPaymentWatcher } = await import('./lib/paymentWatcher');
    startPaymentWatcher();
  }
}
