import { X } from "lucide-react";
import { useRef } from "react";
import { FuwariModal } from "@/components/ui/fuwari-modal";
import {
  ACCEPTED_IMAGE_TYPES,
  MAX_FILE_SIZE,
} from "@/features/media/media.schema";
import { m } from "@/paraglide/messages";
import { useMediaPicker, useMediaUpload } from "../hooks";
import type { MediaAsset } from "../types";
import { MediaPickerGrid } from "./media-picker-grid";

export function MediaPicker({
  open,
  title,
  onClose,
  onSelect,
  returnFocus,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  onSelect: (asset: MediaAsset) => void;
  returnFocus?: () => HTMLElement | null;
}) {
  const picker = useMediaPicker(open);
  const { uploadFiles, isUploading } = useMediaUpload();
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <FuwariModal
      open={open}
      onClose={onClose}
      label={title}
      returnFocus={returnFocus}
      className="fuwari-modal-wide"
    >
      <div className="flex flex-col max-h-[80dvh] overflow-hidden">
        <div className="px-5 pt-5 pb-3 flex items-center justify-between gap-3">
          <h2 className="text-lg font-medium fuwari-text-90">{title}</h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={isUploading}
              onClick={() => fileRef.current?.click()}
              className="fuwari-btn-primary rounded-xl h-9 px-3 text-sm font-medium"
            >
              {m.media_upload()}
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label={m.common_close()}
              className="h-9 w-9 grid place-items-center rounded-lg fuwari-text-50 hover:text-(--fuwari-primary)"
            >
              <X size={16} />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-5 pb-5 min-h-0">
          <MediaPickerGrid picker={picker} onSelect={onSelect} />
        </div>
        <input
          ref={fileRef}
          type="file"
          multiple
          accept={ACCEPTED_IMAGE_TYPES.join(",")}
          className="hidden"
          onChange={(event) => {
            const files = Array.from(event.target.files ?? []).filter(
              (file) => file.size <= MAX_FILE_SIZE,
            );
            if (files.length > 0) void uploadFiles(files);
            event.target.value = "";
          }}
        />
      </div>
    </FuwariModal>
  );
}
