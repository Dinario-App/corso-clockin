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
  BookRow,
  BookSection,
  BookSectionKey,
  HomeBookModel,
} from '@/src/ui/ethena/homeBookModel';

/** The manifest ids `ethenaScreens.ts` holds this file to, one per section. */
const SECTION_TEST_IDS: Readonly<Record<BookSectionKey, string>> = {
  cash: 'ethena-home-tray-cash',
  majors: 'ethena-home-tray-majors',
  sleeve: 'ethena-home-tray-sleeve',
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
        deltaDirection={hero.delta?.direction}
        deltaValue={hero.delta?.value}
        deltaSuffix={hero.delta?.suffix}
      />
      {hero.note ? (
        <CorsoText
          testID="home-book-hero-note"
          style={{
            ...ETHENA_TYPE.sub,
            color: ethena.ink.tertiary,
            textAlign: 'center',
            marginTop: 6,
            paddingHorizontal: ethenaGeometry.gutter,
          }}
        >
          {hero.note}
        </CorsoText>
      ) : null}
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
        {copy.homeBook.venue}
      </CorsoText>
    </View>
  );
}

/**
 * The one card a new book draws in place of the Cash and Everything else
 * trays: the new-book line and the Add cash door, the same door as the verb
 * row's. Existing words only (`copy.homeBook.newBook`, `ADD_CASH_LABEL`).
 * No figure, so Hide balances has nothing here to mask.
 */
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
        <CorsoText
          testID="home-book-new-line"
          style={{
            ...ETHENA_TYPE.rowSub,
            color: ethena.ink.secondary,
            paddingTop: 12,
          }}
        >
          {line}
        </CorsoText>
        <Pressable
          testID="home-book-new-add-cash"
          accessibilityRole="button"
          accessibilityLabel={ADD_CASH_LABEL}
          onPress={onAddCash}
          hitSlop={8}
          style={{ alignSelf: 'flex-start', paddingVertical: 12 }}
        >
          <CorsoText
            style={{ ...ETHENA_TYPE.cardAction, color: ethena.ink.primary }}
          >
            {ADD_CASH_LABEL}
          </CorsoText>
        </Pressable>
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
  const subtotal = newBook ? undefined : section.subtotal;
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
              <View
                key={name.key}
                testID={`${testID}-name-${name.key}`}
                style={{ paddingVertical: 12 }}
              >
                <CorsoText
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
            ))
          : null}
      </EthenaTray>
    </View>
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
        </View>
      </View>
    </View>
  );
  if (!opens || !onOpenRow) return <View testID={testID}>{content}</View>;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={
        row.value ? `${row.name}, ${spokenFigure(row.value)}` : row.name
      }
      onPress={() => onOpenRow(opens)}
    >
      {content}
    </Pressable>
  );
}
