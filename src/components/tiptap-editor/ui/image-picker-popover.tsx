import type { Editor } from "@tiptap/react";
import { CornerDownLeft, Loader2, Upload } from "lucide-react";
import type { KeyboardEvent } from "react";
import { useId, useRef, useState } from "react";
import { IconButton } from "@/components/ui/icon-button";
import { MediaPickerGrid } from "@/features/media/components/media-library/components";
import {
  useMediaPicker,
  useMediaUrlImport,
} from "@/features/media/components/media-library/hooks";
import type { MediaAsset } from "@/features/media/components/media-library/types";
import { ACCEPTED_IMAGE_TYPES } from "@/features/media/media.schema";
import { useImagePicker } from "@/features/posts/editor/extensions/image-placeholder";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";
import { EditorPopover } from "./editor-popover";

const TABS = [
  { id: "upload", label: m.editor_image_tab_upload },
  { id: "link", label: m.editor_image_tab_link },
  { id: "library", label: m.editor_image_tab_library },
] as const;

type Tab = (typeof TABS)[number]["id"];

/**
 * The image picker below an image placeholder: upload a file, import an
 * image URL into the media library, or pick from the library. Picking puts
 * the image in the placeholder's place; Escape or a click elsewhere keeps the
 * placeholder.
 */
export function ImagePickerPopover({ editor }: { editor: Editor | null }) {
  const target = useImagePicker(editor);
  const open = target !== null;
  const [tab, setTab] = useState<Tab>("upload");
  const tabRefs = useRef(new Map<Tab, HTMLButtonElement>());
  const id = useId();
  const library = useMediaPicker(open);

  const fill = (asset: MediaAsset) => {
    editor
      ?.chain()
      .fillImagePlaceholder({
        src: asset.url,
        width: asset.width || undefined,
        height: asset.height || undefined,
      })
      .focus()
      .run();
  };

  const onTabKeyDown = (event: KeyboardEvent) => {
    const step =
      event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (!step) return;
    event.preventDefault();
    const index = TABS.findIndex((item) => item.id === tab);
    const next = TABS[(index + step + TABS.length) % TABS.length].id;
    setTab(next);
    tabRefs.current.get(next)?.focus();
  };

  return (
    <EditorPopover
      editor={editor}
      open={open}
      anchor={target}
      onClose={() => editor?.commands.closeImagePicker()}
      initialFocus={() => tabRefs.current.get(tab) ?? null}
      role="dialog"
      aria-label={m.editor_image_picker_title()}
      className="flex w-96 max-w-[calc(100vw-1rem)] flex-col gap-2 p-2"
    >
      <div role="tablist" className="flex gap-1" onKeyDown={onTabKeyDown}>
        {TABS.map((item) => (
          <button
            key={item.id}
            ref={(element) => {
              if (element) tabRefs.current.set(item.id, element);
              else tabRefs.current.delete(item.id);
            }}
            type="button"
            role="tab"
            id={`${id}-${item.id}-tab`}
            aria-selected={tab === item.id}
            aria-controls={`${id}-${item.id}-panel`}
            tabIndex={tab === item.id ? 0 : -1}
            onClick={() => setTab(item.id)}
            className={cn(
              "h-8 rounded-lg px-3 text-sm font-medium transition-colors",
              tab === item.id
                ? "bg-(--fuwari-btn-regular-bg) text-(--fuwari-primary)"
                : "fuwari-text-50 hover:bg-(--fuwari-btn-plain-bg-hover) hover:text-(--fuwari-primary)",
            )}
          >
            {item.label()}
          </button>
        ))}
      </div>
      <div
        role="tabpanel"
        id={`${id}-${tab}-panel`}
        aria-labelledby={`${id}-${tab}-tab`}
      >
        {tab === "upload" ? (
          <UploadPanel
            onFile={(file) => editor?.commands.uploadImageToPlaceholder(file)}
          />
        ) : tab === "link" ? (
          <LinkPanel known={library.mediaItems} onImport={fill} />
        ) : (
          <div className="max-h-72 overflow-y-auto p-1 custom-scrollbar">
            <MediaPickerGrid
              picker={library}
              onSelect={fill}
              columnsClassName="grid-cols-3"
            />
          </div>
        )}
      </div>
    </EditorPopover>
  );
}

function UploadPanel({ onFile }: { onFile: (file: File) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  return (
    <>
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-(--fuwari-input-border) px-4 py-8 text-sm fuwari-text-50 transition-colors hover:border-(--fuwari-primary) hover:text-(--fuwari-primary)"
      >
        <Upload size={18} />
        {m.editor_image_upload_choose()}
      </button>
      <input
        ref={fileRef}
        type="file"
        accept={ACCEPTED_IMAGE_TYPES.join(",")}
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) onFile(file);
        }}
      />
    </>
  );
}

function LinkPanel({
  known,
  onImport,
}: {
  known: ReadonlyArray<MediaAsset>;
  onImport: (asset: MediaAsset) => void;
}) {
  const [url, setUrl] = useState("");
  const { importUrl, importing } = useMediaUrlImport(known);

  const submit = async () => {
    if (importing) return;
    const asset = await importUrl(url);
    if (asset) onImport(asset);
  };

  return (
    <div className="flex items-center gap-1">
      <input
        type="text"
        inputMode="url"
        value={url}
        onChange={(event) => setUrl(event.target.value)}
        onKeyDown={(event) => {
          if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
          event.preventDefault();
          void submit();
        }}
        aria-label={m.editor_image_url()}
        placeholder="https://"
        disabled={importing}
        className="h-8 min-w-0 flex-1 rounded-lg bg-transparent px-2 text-sm fuwari-text-90 outline-none placeholder:fuwari-text-30"
      />
      <IconButton
        label={m.editor_image_import()}
        onClick={() => void submit()}
        disabled={importing || !url.trim()}
      >
        {importing ? (
          <Loader2 size={14} className="animate-spin" />
        ) : (
          <CornerDownLeft size={14} />
        )}
      </IconButton>
    </div>
  );
}
