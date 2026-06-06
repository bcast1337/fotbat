import { NodeServer } from '@bitdev/node.node-server';

export default NodeServer.from({
  name: 'football-service',
  mainPath: import.meta.resolve('./football-service.app-root.js'),
});
