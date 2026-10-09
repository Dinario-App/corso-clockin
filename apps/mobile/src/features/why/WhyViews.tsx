import type { ReviewWhyBlock } from '@corso/why';
import { reviewWhyBlockFor } from '@corso/why';
import { useEffect } from 'react';
import { View } from 'react-native';
import { ethena } from '@/constants/theme.ethena';
import { ethenaGeometry } from '@/constants/theme.ethenaGeometry';
import { ETHENA_TYPE } from '@/constants/theme.ethenaType';
import { MAJOR_ASSETS } from '@/src/features/balances/majors';
import { isMarketsMajor } from '@/src/features/markets/marketsMovingPresentation';
import { CorsoText } from '@/src/theme/CorsoText';
import { EthenaTray } from '@/src/ui/ethena/EthenaPrimitives';
import { useWhy, type WhyRead } from './useWhy';
import {
  type DeskStripView,
  type DetailsSeenView,
  oneLineFor,
  presentDeskStrip,
  presentReviewWhy,
  type ReviewWhyView,
  type WhyLineView,
} from './whyPresentation';

function Head({
  title,
  right,
  testID,
}: {
  title: string;
  right?: string;
  testID: string;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        columnGap: 8,
        flexWrap: 'wrap',
        paddingHorizontal: ethenaGeometry.gutter,
        paddingBottom: 8,
      }}
    >
      <CorsoText
        testID={`${testID}-title`}
        accessibilityRole="header"
        style={{ ...ETHENA_TYPE.section, color: ethena.ink.secondary }}
      >
        {title}
      </CorsoText>
      {right ? (
        <CorsoText
          testID={`${testID}-as-of`}
          style={{ ...ETHENA_TYPE.rowSub, color: ethena.ink.tertiary }}
        >
          {right}
        </CorsoText>
      ) : null}
    </View>
  );
}

export function WhyLineRow({
  line,
  testID,
  muted = false,
}: {
  line: WhyLineView;
  testID: string;
  /** Details renders a record: the words are in `mute`. */
  muted?: boolean;
}) {
  return (
    <View testID={testID} style={{ paddingVertical: 6 }}>
      <CorsoText
        style={{
          ...ETHENA_TYPE.body,
          color: muted ? ethena.ink.secondary : ethena.ink.primary,
        }}
      >
        {line.text}
      </CorsoText>
      <CorsoText style={{ ...ETHENA_TYPE.rowSub, color: ethena.ink.tertiary }}>
        {line.basis}
      </CorsoText>
    </View>
  );
}

export function ReviewWhyTray({ view }: { view: ReviewWhyView }) {
  if (view.kind === 'absent') return null;
  return (
    <View testID="why-review" style={{ marginTop: ethenaGeometry.gap }}>
      <Head
        testID="why-review"
        title={view.title}
        right={view.kind === 'ready' ? view.asOf : undefined}
      />
      <EthenaTray
        testID="why-review-tray"
        style={{ marginHorizontal: ethenaGeometry.gutter, paddingVertical: 8 }}
      >
        {view.kind === 'ready' ? (
          view.lines.map((line, index) => (
            <WhyLineRow
              key={line.code}
              line={line}
              testID={`why-review-line-${index}`}
            />
          ))
        ) : (
          <CorsoText
            testID="why-review-unavailable"
            style={{
              ...ETHENA_TYPE.rowSub,
              color: ethena.ink.secondary,
              paddingVertical: 12,
            }}
          >
            {view.line}
          </CorsoText>
        )}
      </EthenaTray>
    </View>
  );
}

/** Loading renders nothing and reports nothing; off reports `disabled`. */
export function reviewBlockFromRead(
  read: WhyRead,
  mint: string,
): ReviewWhyBlock | null {
  if (read === 'loading') return null;
  if (read === 'off') return { state: 'disabled' };
  return reviewWhyBlockFor(read, mint);
}

export function ReviewWhySlot({
  mint,
  onBlock,
}: {
  mint: string;
  onBlock: (block: ReviewWhyBlock | null) => void;
}) {
  const read = useWhy('review', [mint]);
  const block = reviewBlockFromRead(read, mint);
  const key = JSON.stringify(block);
  // biome-ignore lint/correctness/useExhaustiveDependencies: `key` is the block's value; `block` is re-created each render
  useEffect(() => {
    onBlock(block);
  }, [key, onBlock]);
  return <ReviewWhyTray view={presentReviewWhy(block)} />;
}

export function DeskStrip({ view }: { view: DeskStripView }) {
  if (view.kind === 'absent') return null;
  return (
    <View testID="why-strip" style={{ marginTop: 18 }}>
      <Head
        testID="why-strip"
        title={view.title}
        right={view.kind === 'ready' ? view.asOf : undefined}
      />
      <EthenaTray
        testID="why-strip-tray"
        style={{ marginHorizontal: ethenaGeometry.gutter, paddingVertical: 8 }}
      >
        {view.kind === 'ready' ? (
          view.cards.map((card) => (
            <View
              key={card.mint}
              testID={`why-strip-card-${card.symbol}`}
              style={{ paddingVertical: 6 }}
            >
              <CorsoText
                style={{ ...ETHENA_TYPE.rowName, color: ethena.ink.primary }}
              >
                {card.symbol}
              </CorsoText>
              <WhyLineRow
                line={card.why}
                testID={`why-strip-card-${card.symbol}-line`}
              />
            </View>
          ))
        ) : (
          <CorsoText
            testID="why-strip-unavailable"
            style={{
              ...ETHENA_TYPE.rowSub,
              color: ethena.ink.secondary,
              paddingVertical: 12,
            }}
          >
            {view.line}
          </CorsoText>
        )}
      </EthenaTray>
    </View>
  );
}

const STRIP_ASSETS = MAJOR_ASSETS.filter(isMarketsMajor).map(
  ({ mint, symbol }) => ({
    mint,
    symbol,
  }),
);
const STRIP_MINTS = STRIP_ASSETS.map((asset) => asset.mint);

export function DeskStripSlot() {
  const read = useWhy('strip', STRIP_MINTS);
  return <DeskStrip view={presentDeskStrip(read, STRIP_ASSETS)} />;
}

export function MajorWhyLineSlot({ mint }: { mint: string }) {
  const read = useWhy('strip', [mint]);
  const line =
    read === 'off' || read === 'loading' ? null : oneLineFor(read, mint);
  return line ? <WhyLineRow line={line} testID="major-detail-why" /> : null;
}

/** Activity Details: *What you saw*, rendered from the frozen record only. */
function SeenRow({
  id,
  label,
  value,
}: {
  id: string;
  label: string;
  value: string;
}) {
  return (
    <View
      testID={id}
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        columnGap: 12,
        flexWrap: 'wrap',
        paddingVertical: 6,
      }}
    >
      <CorsoText style={{ ...ETHENA_TYPE.rowSub, color: ethena.ink.secondary }}>
        {label}
      </CorsoText>
      <CorsoText style={{ ...ETHENA_TYPE.rowSub, color: ethena.ink.secondary }}>
        {value}
      </CorsoText>
    </View>
  );
}

export function DetailsSeenBlock({ view }: { view: DetailsSeenView | null }) {
  if (!view) return null;
  return (
    <View testID="details-seen" style={{ marginTop: 16 }}>
      <Head
        testID="details-seen"
        title={view.heading}
        right={view.capturedAt ?? undefined}
      />
      <EthenaTray
        testID="details-seen-quote"
        style={{ marginHorizontal: ethenaGeometry.gutter, paddingVertical: 8 }}
      >
        <CorsoText
          style={{ ...ETHENA_TYPE.rowSub, color: ethena.ink.tertiary }}
        >
          {view.quoteHeading}
        </CorsoText>
        {view.quote.map((row, index) => (
          <SeenRow
            key={row.label}
            id={`details-seen-quote-${index}`}
            label={row.label}
            value={row.value}
          />
        ))}
      </EthenaTray>
      {view.why ? (
        <EthenaTray
          testID="details-seen-why"
          style={{
            marginHorizontal: ethenaGeometry.gutter,
            marginTop: ethenaGeometry.gap,
            paddingVertical: 8,
          }}
        >
          {view.why.kind === 'lines' ? (
            <>
              <CorsoText
                style={{ ...ETHENA_TYPE.rowSub, color: ethena.ink.tertiary }}
              >
                {view.why.head}
              </CorsoText>
              {view.why.lines.map((line, index) => (
                <WhyLineRow
                  key={line.code}
                  line={line}
                  testID={`details-seen-why-${index}`}
                  muted
                />
              ))}
            </>
          ) : (
            <CorsoText
              style={{ ...ETHENA_TYPE.rowSub, color: ethena.ink.secondary }}
            >
              {view.why.line}
            </CorsoText>
          )}
        </EthenaTray>
      ) : null}
      <CorsoText
        testID="details-seen-note"
        style={{
          ...ETHENA_TYPE.rowSub,
          color: ethena.ink.tertiary,
          paddingHorizontal: ethenaGeometry.gutter,
          paddingTop: 8,
        }}
      >
        {view.note}
      </CorsoText>
    </View>
  );
}
