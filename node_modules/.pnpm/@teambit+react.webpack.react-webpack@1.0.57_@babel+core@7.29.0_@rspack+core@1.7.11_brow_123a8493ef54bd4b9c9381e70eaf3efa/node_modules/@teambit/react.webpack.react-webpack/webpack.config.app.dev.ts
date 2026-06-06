import { Configuration } from 'webpack';
import ReactRefreshWebpackPlugin from '@pmmmwh/react-refresh-webpack-plugin';

// This is the development application configuration.
// It is used for dev servers running the applications.
// It is focused on developer experience, fast rebuilds, and a minimal bundle.
export function configAppDevFactory(): Configuration {
  return {
    plugins: [
      new ReactRefreshWebpackPlugin(),
    ],
  };
}
