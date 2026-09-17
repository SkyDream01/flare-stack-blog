import { useState } from "react";
import "./post-cover.css";

interface PostCoverProps {
  src?: string;
  fallback?: string;
  className?: string;
  loading?: "lazy" | "eager";
}

export function PostCover(props: PostCoverProps) {
  return <PostCoverImage key={props.src ?? "gradient"} {...props} />;
}

function PostCoverImage({
  src,
  fallback,
  className = "",
  loading = "lazy",
}: PostCoverProps) {
  const [status, setStatus] = useState("loading");
  return (
    <div
      className={`post-cover ${className}`}
      data-state={src ? status : "empty"}
      style={{ backgroundImage: fallback }}
      aria-hidden="true"
    >
      {src && (
        <img
          ref={(image) => {
            // Cached images may finish before hydration attaches load handlers.
            if (image?.complete) {
              setStatus(image.naturalWidth > 0 ? "loaded" : "error");
            }
          }}
          src={src}
          alt=""
          loading={loading}
          decoding="async"
          onLoad={() => setStatus("loaded")}
          onError={() => setStatus("error")}
        />
      )}
      {src && status === "loading" && <span className="post-cover-shimmer" />}
    </div>
  );
}
