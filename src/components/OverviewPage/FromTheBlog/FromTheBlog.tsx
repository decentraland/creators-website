import { ChevronRight as ChevronRightIcon } from '@mui/icons-material'
import { useLatestBlogPosts } from '~/hooks/useLatestBlogPosts'
import { useTranslation } from '~/intl'
import { blogUrl } from '~/lib/blog'
import { OverviewSection, trackClick } from '~/lib/overviewAnalytics'
import { formatLongDate } from '~/lib/time'
import { useLocale } from '~/store/locale'
import { AnimatedSection } from '../AnimatedSection'
import * as S from './FromTheBlog.styles'

const FromTheBlog = () => {
  const { t } = useTranslation()
  const locale = useLocale(s => s.locale)
  const { data: posts } = useLatestBlogPosts()

  // Nothing to show while loading, when the CMS fails or has no posts.
  if (!posts || posts.length === 0) return null

  return (
    <AnimatedSection section={OverviewSection.BLOG}>
      <S.Section data-testid="overview-blog">
        <S.Title>
          <span>{t('overview.blog.title_highlight')}</span> {t('overview.blog.title')}
        </S.Title>
        <S.Posts>
          {posts.map(post => (
            <S.PostCard
              key={post.id}
              href={post.url}
              data-testid="overview-blog-card"
              data-place={OverviewSection.BLOG}
              data-title={post.title}
              onClick={trackClick}
            >
              <S.PostImage>{post.imageUrl && <img src={post.imageUrl} alt="" loading="lazy" />}</S.PostImage>
              <S.PostInfo>
                <S.PostMeta>
                  {post.categoryTitle && <S.PostCategory>{post.categoryTitle}</S.PostCategory>}
                  <S.PostDate>{formatLongDate(post.publishedDate, locale)}</S.PostDate>
                </S.PostMeta>
                <S.PostTitle>{post.title}</S.PostTitle>
              </S.PostInfo>
            </S.PostCard>
          ))}
        </S.Posts>
        <S.Centered>
          <S.ViewAllLink
            href={blogUrl()}
            data-testid="overview-blog-all"
            data-place={OverviewSection.BLOG}
            data-title="view-all"
            onClick={trackClick}
          >
            {t('overview.blog.view_all')}
            <ChevronRightIcon />
          </S.ViewAllLink>
        </S.Centered>
      </S.Section>
    </AnimatedSection>
  )
}

export { FromTheBlog }
