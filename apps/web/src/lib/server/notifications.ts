import { config } from "./config";
import type { AuthContext, NotificationService } from "./types";
import type { Task } from "@todobile/contracts";

export function createNotificationService(): NotificationService {
  return {
    async notifyTaskCreated(task: Task, auth: AuthContext) {
      if (!config.pushProviderApiKey) {
        console.info("push.notification.skipped", {
          reason: "missing_provider_key",
          taskId: task.id,
          assignee: task.assignee,
          actor: auth.userId
        });
        return;
      }

      console.info("push.notification.sent", {
        kind: "task_created",
        taskId: task.id,
        assignee: task.assignee
      });
    },

    async notifyCaptureFailed(auth: AuthContext, reason: string) {
      console.warn("push.notification.capture_failed", {
        userId: auth.userId,
        reason
      });
    }
  };
}
