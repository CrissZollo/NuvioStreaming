import { notificationService } from './services/notificationService';

// Call this after all services are imported and initialized
export function initializeServices() {
  notificationService.init();
}
