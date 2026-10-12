import { usePlainRisk } from '@/src/features/plainRisk/usePlainRisk';
import { RiskLevelSlot, spokenRiskLevel } from '@/src/ui/risk/RiskLevel';
import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { copy } from '@/constants/copy';
import { CorsoText } from '@/src/theme/CorsoText';
import { ethena } from '@/constants/theme.ethena';
import { ethenaGeometry } from '@/constants/theme.ethenaGeometry';
import { ETHENA_TYPE } from '@/constants/theme.ethenaType';
import {
  EthenaDirection,
  EthenaDock,
  EthenaGround,
  EthenaQuickDisc,
  EthenaTray,
} from '@/src/ui/ethena/EthenaPrimitives';
import { resolveDeltaInk } from '@/src/ui/ethena/deltaInk';
import {
  EthenaCoin,
  EthenaHero,
  EthenaHomeIndicator,
  EthenaNav,
  EthenaSectionHead,
  EthenaStatusBar,
} from '@/src/ui/ethena/EthenaChrome';
import { TokenIconView } from '@/src/ui/primitives/TokenIconView';
import { maskedFigureLabel, spokenFigure } from '@/src/ui/format/balanceMask';
import type {
  BookName,
  BookRow,
  BookSection,
  BookSectionKey,
  HomeBookModel,
  WealthDoing,
  WealthMix,
  WealthMixStep,
} from '@/src/ui/ethena/homeBookModel';

/** The manifest ids `ethenaScreens.ts` holds this file to, one per section. */
const SECTION_TEST_IDS: Readonly<Record<BookSectionKey, string>> = {
  cash: 'ethena-home-tray-cash',
  majors: 'ethena-home-tray-majors',
  sleeve: 'ethena-home-tray-sleeve',
  gold: 'ethena-home-tray-gold',
  stocks: 'ethena-home-tray-stocks',
};

const ADD_CASH_LABEL = 'Add cash';

export function HomeBook({
  model,
  bookName,
  initials,
  chrome = 'route',
  onAddCash,
  onBuy,
  hideBuy = false,
  today,
  liveDesk,
  onAsk,
  onSettings,
  onOpenProfile,
  onOpenRow,
  onOpenSleeve,
}: {
  model: HomeBookModel;
  bookName: string;
  initials: string;
  chrome?: 'route' | 'canon';
  onAddCash?: () => void;
  onBuy?: () => void;
  hideBuy?: boolean;
  today?: ReactNode;
  liveDesk?: ReactNode;
  onAsk?: () => void;
  onSettings?: () => void;
  onOpenProfile?: () => void;
  onOpenRow?: (opens: NonNullable<BookRow['opens']>) => void;
  /** The Sleeve header opens 06, including when the section has no row yet. */
  onOpenSleeve?: () => void;
}) {
  const canon = chrome === 'canon';
  const body = (
    <>
      <EthenaNav
        left={
          <>
            {onOpenProfile ? (
              <Pressable
                testID="home-book-avatar"
                onPress={onOpenProfile}
                accessibilityRole="button"
                accessibilityLabel={copy.profile.title}
                hitSlop={8}
              >
                <EthenaCoin glyph={initials} size={32} />
              </Pressable>
            ) : (
              <EthenaCoin glyph={initials} size={32} />
            )}
            <CorsoText
              testID="home-book-name"
              numberOfLines={1}
              style={{
                ...ETHENA_TYPE.navMid,
                color: ethena.ink.primary,
                flexShrink: 1,
              }}
            >
              {bookName}
            </CorsoText>
          </>
        }
        right={
          <>
          {onAsk ? (
            <Pressable
              testID="home-book-ask"
              onPress={onAsk}
              accessibilityRole="button"
              accessibilityLabel={copy.launchDock.proposed.ask}
              hitSlop={12}
            >
              <CorsoText
                style={{
                  ...ETHENA_TYPE.navTrailing,
                  color: ethena.ink.secondary,
                }}
              >
                {copy.launchDock.proposed.ask}
              </CorsoText>
            </Pressable>
          ) : null}
          <Pressable
            testID="home-book-settings"
            onPress={onSettings}
            accessibilityRole="button"
            accessibilityLabel="Settings"
            hitSlop={12}
          >
            <CorsoText
              style={{
                ...ETHENA_TYPE.navTrailing,
                color: ethena.ink.secondary,
              }}
            >
              ⚙
            </CorsoText>
          </Pressable>
          </>
        }
      />

      <BookHeroView model={model} />

      {today ?? null}

      <View
        testID="ethena-home-verbs"
        style={{
          flexDirection: 'row',
          justifyContent: 'space-around',
          paddingHorizontal: ethenaGeometry.gutter,
          paddingTop: 18,
          paddingBottom: 22,
        }}
      >
        <EthenaQuickDisc
          testID="ethena-home-quick-add-cash"
          glyph="+"
          label={ADD_CASH_LABEL}
          onPress={onAddCash}
          plane="cta"
        />
        {hideBuy ? null : <EthenaQuickDisc
          testID="ethena-home-quick-buy"
          glyph="↗"
          label={copy.buy.title}
          onPress={onBuy}
          plane="cta"
        />}
      </View>

      {model.wealth?.doing ? <WealthDoingCard doing={model.wealth.doing} /> : null}
      {model.wealth?.mix ? <WealthMixCard mix={model.wealth.mix} /> : null}

      {model.newBookLine && liveDesk ? (
        <View style={{ marginBottom: 14 }}>{liveDesk}</View>
      ) : null}

      {model.newBookLine ? (
        <NewBookCard line={model.newBookLine} onAddCash={onAddCash} />
      ) : null}

      {model.sections?.map((section) =>
        model.newBookLine && section.key !== 'majors' ? null : (
          <BookSectionView
            key={section.key}
            section={section}
            newBook={model.newBookLine != null}
            onOpenRow={onOpenRow}
            onOpenSleeve={section.key === 'sleeve' ? onOpenSleeve : undefined}
          />
        ),
      )}
    </>
  );

  if (!canon) return body;

  return (
    <EthenaGround>
      <EthenaStatusBar />
      {body}
      <View style={{ flex: 1 }} />
      <EthenaDock
        testID="ethena-home-dock"
        items={[
          { label: 'Home', glyph: '▤' },
          { label: 'Activity', glyph: '⇄' },
          { label: 'Profile', glyph: '○' },
        ]}
        activeIndex={0}
      />
      <EthenaHomeIndicator />
    </EthenaGround>
  );
}

function BookHeroView({ model }: { model: HomeBookModel }) {
  const hero = model.hero;
  if (hero.kind === 'unavailable') {
    return (
      <View
        testID="ethena-home-hero"
        style={{
          paddingHorizontal: ethenaGeometry.gutter,
          paddingTop: 4,
          alignItems: 'center',
        }}
      >
        <CorsoText
          testID="home-book-unavailable"
          style={{
            ...ETHENA_TYPE.body,
            color: ethena.ink.secondary,
            textAlign: 'center',
          }}
        >
          {hero.message}
        </CorsoText>
      </View>
    );
  }
  if (hero.kind === 'loading') {
    return (
      <EthenaHero
        testID="ethena-home-hero"
        paddingTop={4}
        eyebrow={hero.eyebrow}
        amount={hero.placeholder}
      />
    );
  }
  return (
    <View>
      <EthenaHero
        testID="ethena-home-hero"
        paddingTop={4}
        eyebrow={hero.eyebrow}
        amount={hero.amount}
        amountAccessibilityLabel={maskedFigureLabel(hero.amount)}
        cents={hero.cents ?? undefined}
        deltaDirection={hero.delta?.direction ?? undefined}
        deltaValue={hero.delta?.value}
        deltaSuffix={hero.delta?.suffix}
      />
      {hero.note ? (
        <CorsoText
          testID="home-book-hero-note"
          style={{
            ...ETHENA_TYPE.sub,
            color:
              hero.noteTone === 'stale'
                ? ethena.ink.secondary
                : ethena.ink.tertiary,
            textAlign: 'center',
            marginTop: 6,
            paddingHorizontal: ethenaGeometry.gutter,
          }}
        >
          {hero.note}
        </CorsoText>
      ) : null}
      {model.newBookLine ? (
        <CorsoText
          testID="home-book-venue"
          style={{
            ...ETHENA_TYPE.rowSub,
            color: ethena.ink.tertiary,
            textAlign: 'center',
            marginTop: 4,
            paddingHorizontal: ethenaGeometry.gutter,
          }}
        >
          {copy.homeBook.zeroLine}
        </CorsoText>
      ) : null}
    </View>
  );
}

function WealthDoingCard({ doing }: { doing: WealthDoing }) {
  return (
    <View style={{ marginBottom: 14 }}>
      <EthenaTray
        testID="ethena-home-tray-doing"
        style={{ marginHorizontal: ethenaGeometry.gutter, paddingVertical: 14 }}
      >
        <CorsoText
          accessibilityRole="header"
          style={{ ...ETHENA_TYPE.cardHeading, color: ethena.ink.primary }}
        >
          {doing.title}
        </CorsoText>
        {doing.rows.map((row) => (
          <View
            key={row.key}
            testID={`home-book-doing-${row.key}`}
            accessible
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              columnGap: 12,
              marginTop: 8,
            }}
          >
            <CorsoText
              style={{ ...ETHENA_TYPE.rowSub, color: ethena.ink.secondary }}
            >
              {row.label}
            </CorsoText>
            <CorsoText
              style={{ ...ETHENA_TYPE.rowSub, color: ethena.ink.primary }}
            >
              {row.value}
            </CorsoText>
          </View>
        ))}
      </EthenaTray>
    </View>
  );
}

const MIX_STEP_INK: Readonly<
  Record<WealthMixStep, { color: string; opacity: number }>
> = {
  0: { color: ethena.ink.primary, opacity: 1 },
  1: { color: ethena.ink.secondary, opacity: 1 },
  2: { color: ethena.ink.tertiary, opacity: 1 },
  3: { color: ethena.ink.tertiary, opacity: 0.5 },
};

function WealthMixCard({ mix }: { mix: WealthMix }) {
  return (
    <View style={{ marginBottom: 14 }}>
      <EthenaTray
        testID="ethena-home-tray-mix"
        style={{ marginHorizontal: ethenaGeometry.gutter, paddingVertical: 14 }}
      >
        <CorsoText
          accessibilityRole="header"
          style={{ ...ETHENA_TYPE.cardHeading, color: ethena.ink.primary }}
        >
          {mix.title}
        </CorsoText>
        {mix.kind === 'unavailable' ? (
          <CorsoText
            testID="home-book-mix-unavailable"
            style={{
              ...ETHENA_TYPE.rowSub,
              color: ethena.ink.secondary,
              marginTop: 6,
            }}
          >
            {mix.line}
          </CorsoText>
        ) : (
          <>
            {mix.segments.length > 0 ? (
              <View
                testID="home-book-mix-bar"
                accessible={false}
                importantForAccessibility="no-hide-descendants"
                style={{
                  flexDirection: 'row',
                  height: 8,
                  marginTop: 12,
                  columnGap: 3,
                }}
              >
                {mix.segments.map((segment) => (
                  <View
                    key={segment.key}
                    testID={`home-book-mix-segment-${segment.key}`}
                    style={{
                      flexGrow: segment.percent,
                      flexBasis: 0,
                      borderRadius: 4,
                      backgroundColor: MIX_STEP_INK[segment.step].color,
                      opacity: MIX_STEP_INK[segment.step].opacity,
                    }}
                  />
                ))}
              </View>
            ) : null}
            <View
              testID="home-book-mix-legend"
              style={{
                flexDirection: 'row',
                flexWrap: 'wrap',
                columnGap: 14,
                rowGap: 4,
                marginTop: 10,
              }}
            >
              {mix.legend.map((entry) => (
                <View
                  key={entry.key}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
                >
                  <View
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 2,
                      backgroundColor: MIX_STEP_INK[entry.step].color,
                      opacity: MIX_STEP_INK[entry.step].opacity,
                    }}
                  />
                  <CorsoText
                    testID={`home-book-mix-legend-${entry.key}`}
                    style={{ ...ETHENA_TYPE.rowSub, color: ethena.ink.secondary }}
                  >
                    {entry.text}
                  </CorsoText>
                </View>
              ))}
            </View>
          </>
        )}
      </EthenaTray>
    </View>
  );
}

function NewBookCard({
  line,
  onAddCash,
}: {
  line: string;
  onAddCash?: () => void;
}) {
  return (
    <View style={{ marginBottom: 14 }}>
      <EthenaTray
        testID="ethena-home-tray-new"
        style={{
          marginHorizontal: ethenaGeometry.gutter,
          paddingVertical: 6,
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            columnGap: 12,
            paddingVertical: 12,
          }}
        >
          <View style={{ flex: 1 }}>
            <CorsoText
              testID="home-book-new-line"
              style={{ ...ETHENA_TYPE.cardHeading, color: ethena.ink.primary }}
            >
              {line}
            </CorsoText>
            <CorsoText
              testID="home-book-new-body"
              style={{
                ...ETHENA_TYPE.rowSub,
                color: ethena.ink.secondary,
                marginTop: 2,
              }}
            >
              {copy.homeBook.newBookBody}
            </CorsoText>
          </View>
          <Pressable
            testID="home-book-new-add-cash"
            accessibilityRole="button"
            accessibilityLabel={ADD_CASH_LABEL}
            onPress={onAddCash}
            hitSlop={8}
            style={{ minHeight: 44, justifyContent: 'center' }}
          >
            <CorsoText
              style={{ ...ETHENA_TYPE.cardAction, color: ethena.ink.primary }}
            >
              {ADD_CASH_LABEL}
            </CorsoText>
          </Pressable>
        </View>
      </EthenaTray>
    </View>
  );
}

function BookSectionView({
  section,
  newBook = false,
  onOpenRow,
  onOpenSleeve,
}: {
  section: BookSection;
  newBook?: boolean;
  onOpenRow?: (opens: NonNullable<BookRow['opens']>) => void;
  onOpenSleeve?: () => void;
}) {
  const testID = SECTION_TEST_IDS[section.key];
  if (
    newBook &&
    section.rows.length === 0 &&
    (section.names?.length ?? 0) === 0
  ) {
    return null;
  }
  if (section.status !== undefined) {
    return (
      <View testID={testID} style={{ marginBottom: 14 }}>
        <EthenaSectionHead
          label={section.label}
          right={section.status}
          rightAccessibilityLabel={section.status}
          separates
        />
      </View>
    );
  }
  const subtotal = newBook || section.subtotal === '' ? undefined : section.subtotal;
  const head = (
    <EthenaSectionHead
      label={section.label}
      right={subtotal}
      rightAccessibilityLabel={maskedFigureLabel(subtotal)}
      separates
    />
  );
  return (
    <View style={{ marginBottom: 14 }}>
      {onOpenSleeve ? (
        <Pressable
          testID="home-book-open-sleeve"
          accessibilityRole="button"
          accessibilityLabel={section.label}
          onPress={onOpenSleeve}
        >
          {head}
        </Pressable>
      ) : (
        head
      )}
      <EthenaTray
        testID={testID}
        style={{
          marginHorizontal: ethenaGeometry.gutter,
          paddingVertical: 6,
        }}
      >
        {section.rows.length === 0 && (section.names?.length ?? 0) === 0 ? (
          <CorsoText
            testID={`${testID}-empty`}
            style={{
              ...ETHENA_TYPE.rowSub,
              color: ethena.ink.secondary,
              paddingVertical: 12,
            }}
          >
            {section.emptyLine}
          </CorsoText>
        ) : (
          section.rows.map((row) => (
            <BookRowView
              key={row.key}
              row={row}
              testID={`${testID}-row-${row.key}`}
              onOpenRow={onOpenRow}
            />
          ))
        )}
        {section.key === 'majors'
          ? section.names?.map((name) => (
              <BookNameView
                key={name.key}
                name={name}
                testID={`${testID}-name-${name.key}`}
                onOpenRow={onOpenRow}
              />
            ))
          : null}
      </EthenaTray>
    </View>
  );
}

function BookNameView({
  name,
  testID,
  onOpenRow,
}: {
  name: BookName;
  testID: string;
  onOpenRow?: (opens: NonNullable<BookRow['opens']>) => void;
}) {
  const risk = usePlainRisk(name.mint);
  const content = (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 12,
      }}
    >
      <TokenIconView
        symbol={name.symbol}
        mint={name.mint}
        size={36}
        accessibilityLabel={name.name}
        accessible={false}
      />
      <View style={{ flex: 1, minWidth: 0 }}>
        <CorsoText
          numberOfLines={2}
          style={{ ...ETHENA_TYPE.rowName, color: ethena.ink.primary }}
        >
          {name.name}
        </CorsoText>
        <CorsoText
          style={{ ...ETHENA_TYPE.rowSub, color: ethena.ink.tertiary }}
        >
          {name.symbol}
        </CorsoText>
      </View>
      {name.price ? (
        <View style={{ alignItems: 'flex-end' }}>
          <CorsoText
            style={{ ...ETHENA_TYPE.rowValue, color: ethena.ink.primary }}
          >
            {name.price}
          </CorsoText>
          {name.change ? (
            <View
              style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
            >
              {name.change.direction ? (
                <EthenaDirection
                  testID={`${testID}-direction`}
                  direction={name.change.direction}
                />
              ) : null}
              <CorsoText
                style={{
                  ...ETHENA_TYPE.rowDelta,
                  color: resolveDeltaInk(name.change.direction),
                }}
              >
                {name.change.text}
              </CorsoText>
            </View>
          ) : null}
          <RiskLevelSlot read={risk} testID={`${testID}-risk`} />
        </View>
      ) : (
        <RiskLevelSlot read={risk} testID={`${testID}-risk`} />
      )}
    </View>
  );
  if (!onOpenRow) return <View testID={testID}>{content}</View>;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={[
        name.name,
        name.price,
        spokenRiskLevel(risk),
      ]
        .filter((part): part is string => part != null)
        .join(', ')}
      onPress={() => onOpenRow({ kind: 'major', mint: name.mint })}
    >
      {content}
    </Pressable>
  );
}

function BookRowView({
  row,
  testID,
  onOpenRow,
}: {
  row: BookRow;
  testID: string;
  onOpenRow?: (opens: NonNullable<BookRow['opens']>) => void;
}) {
  const opens = row.opens;
  const risk = usePlainRisk(row.mint ?? null);
  const content = (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 12,
      }}
    >
      {row.symbol ? (
        <TokenIconView
          symbol={row.symbol}
          mint={row.mint}
          size={36}
          accessibilityLabel={row.name}
          accessible={false}
        />
      ) : (
        <EthenaCoin glyph={row.glyph} mark={row.mark} />
      )}
      <View
        style={{
          flex: 1,
          flexDirection: 'row',
          flexWrap: 'wrap',
          alignItems: 'center',
          columnGap: 8,
        }}
      >
        <View style={{ flexGrow: 1, flexShrink: 1, minWidth: 150 }}>
          <CorsoText
            style={{ ...ETHENA_TYPE.rowName, color: ethena.ink.primary }}
          >
            {row.name}
          </CorsoText>
          {row.sub ? (
            <CorsoText
              style={{ ...ETHENA_TYPE.rowSub, color: ethena.ink.tertiary }}
              accessibilityLabel={maskedFigureLabel(row.sub)}
            >
              {row.sub}
            </CorsoText>
          ) : null}
        </View>
        <View style={{ alignItems: 'flex-end', marginLeft: 'auto' }}>
          {row.value !== null ? (
            <CorsoText
              style={{ ...ETHENA_TYPE.rowValue, color: ethena.ink.primary }}
              accessibilityLabel={maskedFigureLabel(row.value)}
            >
              {row.value}
            </CorsoText>
          ) : null}
          {row.delta ? (
            <View
              style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
            >
              {row.deltaDirection ? (
                <EthenaDirection
                  testID={`${testID}-direction`}
                  direction={row.deltaDirection}
                />
              ) : null}
              <CorsoText
                style={{
                  ...ETHENA_TYPE.rowDelta,
                  color: resolveDeltaInk(row.deltaDirection),
                }}
              >
                {row.delta}
              </CorsoText>
            </View>
          ) : null}
          {row.mint ? (
            <RiskLevelSlot read={risk} testID={`${testID}-risk`} />
          ) : null}
        </View>
      </View>
    </View>
  );
  if (!opens || !onOpenRow) return <View testID={testID}>{content}</View>;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={[
        row.name,
        row.value ? spokenFigure(row.value) : null,
        row.mint ? spokenRiskLevel(risk) : null,
      ]
        .filter((part): part is string => part != null)
        .join(', ')}
      onPress={() => onOpenRow(opens)}
    >
      {content}
    </Pressable>
  );
}
