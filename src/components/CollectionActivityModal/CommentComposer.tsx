import { useState } from 'react'
import { useTranslation } from '~/intl'
import { Button } from '~/components/Button'
import { NoteField } from '~/components/NoteField'
import { usePostComment } from '~/hooks/useCollectionEvents'
import { type Collection } from '~/lib/collections'
import { COMMENT_MAX_LENGTH, type ReviewParty } from '~/lib/events'
import * as S from './CollectionActivityModal.styles'

// The limit rarely matters, so the length only shows once it is close.
const COUNT_FROM = COMMENT_MAX_LENGTH * 0.8

type Props = {
  collection: Collection
  address: string
  /** The side of the review the signed-in wallet writes as. */
  role: ReviewParty
}

/** The box creators and curators write to each other from, on top of the timeline their messages land in. */
export function CommentComposer({ collection, address, role }: Props) {
  const { t } = useTranslation()
  const post = usePostComment(address)
  const [message, setMessage] = useState('')
  const trimmed = message.trim()

  function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!trimmed || post.isPending) return
    post.mutate({ collection, message: trimmed, role }, { onSuccess: () => setMessage('') })
  }

  return (
    <S.Composer onSubmit={submit} data-testid="activity-composer">
      <NoteField
        label={t(`activity_modal.comment.label_${role}`)}
        value={message}
        onChange={setMessage}
        maxLength={COMMENT_MAX_LENGTH}
        placeholder={t(`activity_modal.comment.placeholder_${role}`)}
        disabled={post.isPending}
        hideCount
        fixedSize
        testId="activity-comment-input"
      />
      {post.isError && (
        <S.ComposerError data-testid="activity-comment-error">{t('activity_modal.comment.error')}</S.ComposerError>
      )}
      <S.ComposerActions>
        {message.length >= COUNT_FROM && (
          <S.ComposerCount data-testid="activity-comment-count">
            {message.length}/{COMMENT_MAX_LENGTH}
          </S.ComposerCount>
        )}
        <Button
          type="submit"
          size="sm"
          loading={post.isPending}
          disabled={!trimmed}
          data-testid="activity-comment-send"
        >
          {t('activity_modal.comment.send')}
        </Button>
      </S.ComposerActions>
    </S.Composer>
  )
}
