import { DurableObject } from "cloudflare:workers";
import * as PostService from "@/features/posts/services/posts.service";
import { getDb } from "@/lib/db";

/**
 * Serializes publishing per Post. Saves do not pass through here, so a stated
 * saveToken is enforced by publishPost's conditional write, not by this lock.
 */
export class PostPublisher extends DurableObject {
  async publish(postId: number, saveToken?: string) {
    return PostService.publishPost(this.serviceContext(), {
      id: postId,
      saveToken,
    });
  }

  async unpublish(postId: number) {
    return PostService.unpublishPost(this.serviceContext(), { id: postId });
  }

  private serviceContext() {
    return {
      env: this.env,
      db: getDb(this.env),
      executionCtx: this.ctx as unknown as ExecutionContext,
    };
  }
}
