import { useState } from 'react'
import { Button } from '~/components/Button'
import { Modal } from '~/components/Modal'
import { useObjectURL } from '~/hooks/useObjectURL'
import { useTranslation } from '~/intl'
import { VideoDropzone } from './VideoDropzone'
import * as S from './VideoModal.styles'

type Props = {
  /** The current preview video, or null when the item has none yet. */
  video: Blob | null
  /** A picked file replaces the video. */
  onChange: (video: File) => void
  onClose: () => void
}

/**
 * Smart wearable preview video editor, stacked over the add-items modal (legacy UploadVideoStep +
 * EditVideoModal): drop or browse an MP4, watch it, replace it. Holds no draft state.
 */
export function VideoModal({ video, onChange, onClose }: Props) {
  const { t } = useTranslation()
  const [isReplacing, setReplacing] = useState(false)
  const videoUrl = useObjectURL(video)
  const showPlayer = !!video && !isReplacing

  return (
    <Modal title={t('video_modal.title')} onClose={onClose} testId="video-modal">
      <S.Wrap>
        {showPlayer && videoUrl ? (
          <>
            <S.Player
              src={videoUrl}
              controls
              controlsList="nodownload noremoteplayback"
              disablePictureInPicture
              playsInline
              data-testid="video-modal-player"
            />
            <S.Actions>
              <Button
                type="button"
                variant="secondary"
                data-testid="video-modal-replace"
                onClick={() => setReplacing(true)}
              >
                {t('video_modal.replace')}
              </Button>
              <Button type="button" variant="primary" data-testid="video-modal-done" onClick={onClose}>
                {t('video_modal.done')}
              </Button>
            </S.Actions>
          </>
        ) : (
          <>
            <S.Description>{t('video_modal.description')}</S.Description>
            <VideoDropzone
              testId="video-modal-dropzone"
              onPick={file => {
                onChange(file)
                setReplacing(false)
              }}
            />
            {isReplacing && (
              <S.Actions>
                <Button
                  type="button"
                  variant="secondary"
                  data-testid="video-modal-cancel"
                  onClick={() => setReplacing(false)}
                >
                  {t('video_modal.cancel')}
                </Button>
              </S.Actions>
            )}
          </>
        )}
      </S.Wrap>
    </Modal>
  )
}
