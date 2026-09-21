'use client'

import { useEffect, useRef, useState } from 'react'
import { Camera, Crop } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { ImageCropper, type CroppedImage } from '@/components/settings/image-cropper'

/**
 * PICK, FRAME AND PREVIEW A PROFILE PHOTO. ONE COPY, TWO SCREENS.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHY THIS WAS EXTRACTED
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * "All users should have their personal account setup … you set a hack."
 *
 * Fair. `/profile` — the screen somebody opens when they want their profile —
 * had a camera button that navigated to Settings. Two screens for one job, and
 * the photo was not settable where the profile is.
 *
 * The obvious fix was to copy the control across. It is ~160 lines of file
 * input, `accept` list, type and size refusal, cropper hand-off, object-URL
 * lifecycle and preview — and every one of those is a place two copies would
 * drift. The `accept` list alone has to match the server's five formats; a
 * second copy that missed the next change to it would fail after the upload.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * IT DOES NOT DECIDE WHEN TO SAVE, AND THAT IS DELIBERATE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * The two callers genuinely differ, and forcing one behaviour would have made
 * one of them wrong:
 *
 *   Settings → Profile   is a FORM. The photo is one field among fifteen, and it
 *                        is saved with the rest in a single multipart PUT, so a
 *                        half-finished edit is one Save or one Cancel. A photo
 *                        that saved itself the moment it was cropped would commit
 *                        half a form.
 *   /profile             has no form. There is nothing to press, so the photo has
 *                        to save itself — and then the header avatar has to
 *                        follow, which is the parent's business, not this
 *                        component's.
 *
 * So this emits the cropped file through `onPicked` and stops. One caller stages
 * it; the other uploads it. Neither has to know what the other does.
 */

/** Exactly what `AccountController` accepts — see its `image` validation rule. */
const ACCEPTED = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']

/*
 * Generous, because the cropper has made the original's size almost irrelevant:
 * what gets uploaded is its ~80KB 512x512 export, whatever came in. The server's
 * own limit is 2MB and this used to match it, which turned away every 4-8MB phone
 * photo — the exact files the cropper exists to handle.
 *
 * A ceiling is still worth having an order of magnitude up: decoding costs roughly
 * width x height x 4 bytes regardless of how well the file compresses, so a truly
 * enormous image can still take the tab down.
 */
const MAX_PICK = 25 * 1024 * 1024

export function ProfilePhotoPicker({
  /** The stored photo's URL, or null when there is none. */
  imageUrl,
  /** Shown when there is no photo, or when one fails to load. */
  initials,
  /**
   * A cropped file is ready.
   *
   * Called with `null` when the person cancels a staged photo, so a parent that
   * stages can clear it.
   */
  onPicked,
  /** Set while the parent is uploading, so the controls cannot be used twice. */
  busy = false,
  /**
   * The staged preview, when the parent is holding one.
   *
   * Passed in rather than kept here because the parent owns whether a photo is
   * pending: Settings holds it until Save, `/profile` never holds one at all.
   */
  preview,
  className,
}: {
  imageUrl?: string | null
  initials: string
  onPicked: (picked: CroppedImage | null) => void
  busy?: boolean
  preview?: string | null
  className?: string
}) {
  const fileInput = useRef<HTMLInputElement | null>(null)

  /** The file waiting to be framed. Never uploaded as picked. */
  const [pending, setPending] = useState<File | null>(null)

  /**
   * As picked, so "Adjust" reframes from full resolution.
   *
   * Reopening the cropped result instead would lose resolution on every pass and
   * could never recover framing that had already been discarded.
   */
  const [original, setOriginal] = useState<File | null>(null)

  const [error, setError] = useState<string | null>(null)

  // The parent owns `preview`, but this component created the URL, so it revokes
  // it. Without this every photo somebody previews leaks for the life of the tab.
  const created = useRef<string | null>(null)

  useEffect(() => {
    return () => {
      if (created.current) URL.revokeObjectURL(created.current)
    }
  }, [])

  function choose(file: File | null) {
    if (!file) return

    if (!ACCEPTED.includes(file.type)) {
      setError(
        'That kind of image cannot be used. JPG, PNG, GIF or WEBP — a photo from an iPhone may need converting.',
      )
      return
    }

    if (file.size > MAX_PICK) {
      setError(
        `That image is ${(file.size / 1024 / 1024).toFixed(0)}MB, which is too large to open here. Anything up to 25MB is fine — it gets resized when you position it.`,
      )
      return
    }

    setError(null)
    setPending(file)
  }

  return (
    <div className={cn('flex flex-wrap items-center gap-5', className)}>
      {/*
        `AvatarImage` rather than a bare `<img>`: it falls back on the load ERROR,
        not merely on the URL being absent. An avatar key is `<id>_<random>.<ext>`
        and every upload writes a new one, so a URL from a stale `/account/me`
        response showed an empty circle with no initials and nothing to explain it.
      */}
      <Avatar className="size-20">
        <AvatarImage src={preview ?? imageUrl ?? undefined} alt="" />
        <AvatarFallback className="bg-primary/10 text-xl font-semibold text-primary">
          {initials}
        </AvatarFallback>
      </Avatar>

      <div className="space-y-2">
        <input
          ref={fileInput}
          type="file"
          /*
           * THE SERVER'S OWN LIST, NOT `image/*`.
           *
           * `image/*` offers every format the operating system can produce against
           * a server that accepts five. The gap is not theoretical: an iPhone
           * shoots HEIC by default, so the most likely file anybody picks on a
           * phone was one the server would reject — after uploading it in full.
           *
           * `accept` is a hint a determined person can bypass, which is why
           * `choose` repeats the check rather than trusting it.
           */
          accept="image/jpeg,image/png,image/gif,image/webp,.jpg,.jpeg,.png,.gif,.webp"
          className="sr-only"
          onChange={(event) => {
            const file = event.target.files?.[0] ?? null
            // So choosing the same file twice in a row still fires onChange.
            event.target.value = ''
            choose(file)
          }}
        />

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => fileInput.current?.click()}
          >
            <Camera className="size-4" aria-hidden="true" />
            {imageUrl || preview ? 'Change photo' : 'Upload photo'}
          </Button>

          {/*
            REFRAMING WITHOUT RE-PICKING.

            Without this, changing your mind about the framing meant finding the
            file again — and on a phone, going back through the camera roll to the
            same photo is the moment people give up.
          */}
          {original && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => setPending(original)}
            >
              <Crop className="size-4" aria-hidden="true" />
              Adjust
            </Button>
          )}

          {preview && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={() => {
                if (created.current) {
                  URL.revokeObjectURL(created.current)
                  created.current = null
                }
                setOriginal(null)
                onPicked(null)
              }}
            >
              Cancel
            </Button>
          )}
        </div>

        {/*
          One line, three states: refused, chosen but unsaved, or the rules. The
          refusal takes the same slot so it cannot be missed — it was going to be a
          banner at the top of the form, a screen away from the button that caused it.
        */}
        {error ? (
          <p role="alert" className="text-xs text-destructive">
            {error}
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">
            {preview
              ? 'Positioned — not saved yet.'
              : 'JPG, PNG, GIF or WEBP. You choose which part is used.'}
          </p>
        )}
      </div>

      {/*
        Keyed on the file so picking a second one opens centred, rather than at the
        previous photo's zoom and pan — which would look like the control had
        ignored the new file.
      */}
      {pending && (
        <ImageCropper
          key={`${pending.name}-${pending.size}-${pending.lastModified}`}
          file={pending}
          shape="circle"
          title="Position your photo"
          onCancel={() => setPending(null)}
          onApply={(result) => {
            if (created.current) URL.revokeObjectURL(created.current)
            created.current = result.preview

            setOriginal(pending)
            setPending(null)
            setError(null)
            onPicked(result)
          }}
        />
      )}
    </div>
  )
}
