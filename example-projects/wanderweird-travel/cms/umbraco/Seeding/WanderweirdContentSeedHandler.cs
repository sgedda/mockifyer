using Umbraco.Cms.Core;
using Umbraco.Cms.Core.Composing;
using Umbraco.Cms.Core.Events;
using Umbraco.Cms.Core.Models;
using Umbraco.Cms.Core.Notifications;
using Umbraco.Cms.Core.Services;
using Umbraco.Cms.Core.Strings;

namespace Wanderweird.Cms.Seeding;

public class WanderweirdSeedComposer : IComposer
{
    public void Compose(IUmbracoBuilder builder)
    {
        builder.AddNotificationAsyncHandler<UmbracoApplicationStartedNotification, WanderweirdContentSeedHandler>();
    }
}

/// <summary>
/// Seeds document types + the mobile menu tree.
/// Bottom tabs = children of mobileApp; stacked screens = descendants of each tab.
/// Advanced editors (boolean, numeric, date, tags, color, rich text, multi-string, picker)
/// are added even when the types already exist.
/// </summary>
public class WanderweirdContentSeedHandler : INotificationAsyncHandler<UmbracoApplicationStartedNotification>
{
    private readonly IRuntimeState _runtimeState;
    private readonly IContentTypeService _contentTypeService;
    private readonly IContentService _contentService;
    private readonly IDataTypeService _dataTypeService;
    private readonly IShortStringHelper _shortStringHelper;
    private readonly ILogger<WanderweirdContentSeedHandler> _logger;

    public WanderweirdContentSeedHandler(
        IRuntimeState runtimeState,
        IContentTypeService contentTypeService,
        IContentService contentService,
        IDataTypeService dataTypeService,
        IShortStringHelper shortStringHelper,
        ILogger<WanderweirdContentSeedHandler> logger)
    {
        _runtimeState = runtimeState;
        _contentTypeService = contentTypeService;
        _contentService = contentService;
        _dataTypeService = dataTypeService;
        _shortStringHelper = shortStringHelper;
        _logger = logger;
    }

    public async Task HandleAsync(UmbracoApplicationStartedNotification notification, CancellationToken cancellationToken)
    {
        if (_runtimeState.Level != RuntimeLevel.Run)
        {
            return;
        }

        try
        {
            await EnsureDocumentTypesAsync();
            EnsureContentTree();
            EnsureNestedStacks();
            PatchAdvancedValues();
            _logger.LogInformation("Wanderweird CMS menu tree is ready (app/page configs + recursive stacked pages).");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to seed Wanderweird CMS content. cms-api fallback seed will still work.");
        }
    }

    private async Task EnsureDocumentTypesAsync()
    {
        var textstring = await RequireDataTypeAsync("Textstring");
        var textarea = await RequireDataTypeAsync("Textarea");
        var booleanDt = await TryDataTypeAsync("True/false", "True/False", "Checkbox") ?? textstring;
        var numeric = await TryDataTypeAsync("Numeric", "Integer", "Decimal") ?? textstring;
        var datePicker = await TryDataTypeAsync("Date Picker", "Date/Time", "Date Picker with time") ?? textstring;
        var tags = await TryDataTypeAsync("Tags") ?? textstring;
        var colorPicker = await TryDataTypeAsync("Color Picker", "Eyedropper", "Color Picker Eye Dropper") ?? textstring;
        var multiText = await TryDataTypeAsync("Multiple Textstring", "Multiple Text String") ?? textarea;
        var richtext = await TryDataTypeAsync("Richtext editor", "Rich Text Editor", "TinyMCE") ?? textarea;
        var contentPicker = await TryDataTypeAsync("Content Picker", "Content Picker (Single)");
        var dropdown = await TryDataTypeAsync("Dropdown", "Dropdown list", "Select");

        await CreateTypeIfMissingAsync("contentPage", "Content Page", "icon-document", false, Array.Empty<(string, string, IDataType)>());
        await CreateTypeIfMissingAsync("tabScreen", "Tab Screen", "icon-tabs", false, Array.Empty<(string, string, IDataType)>());
        await CreateTypeIfMissingAsync("mobileApp", "Mobile App", "icon-phone-portrait", true, Array.Empty<(string, string, IDataType)>());

        await EnsurePropertiesAsync("contentPage", new[]
        {
            ("bodyText", "Body Text", textarea),
            ("bodyRich", "Body (Rich Text)", richtext),
            ("imageUrl", "Image URL", textstring),
            ("ctaLabel", "CTA Label", textstring),
            ("featured", "Featured", booleanDt),
            ("readingMinutes", "Reading Minutes", numeric),
            ("chaosHint", "Chaos Hint", numeric),
            ("storyDate", "Story Date", datePicker),
            ("topics", "Topics", tags),
            ("accentColor", "Accent Color", colorPicker),
            ("highlights", "Highlights", multiText),
        });

        if (contentPicker != null)
        {
            await EnsurePropertiesAsync("contentPage", new[]
            {
                ("relatedPage", "Related Page", contentPicker),
            });
        }

        await EnsurePropertiesAsync("tabScreen", new[]
        {
            ("screenKey", "Screen Key", textstring),
            ("iconGlyph", "Icon Glyph", textstring),
            ("heroTitle", "Hero Title", textstring),
            ("heroSubtitle", "Hero Subtitle", textarea),
            ("heroImageUrl", "Hero Image URL", textstring),
            ("sortOrder", "Sort Order", textstring),
            ("featured", "Featured Tab", booleanDt),
            ("accentColor", "Accent Color", colorPicker),
        });

        await EnsurePropertiesAsync("mobileApp", new[]
        {
            ("appTitle", "App Title", textstring),
            ("tagline", "Tagline", textarea),
            // Global app config — consumed by the Expo client via cms-api
            ("showLuggageLottery", "Show Luggage Lottery", booleanDt),
            ("enableChaosDice", "Enable Chaos Dice", booleanDt),
            ("enableGraphqlTrips", "Enable GraphQL Trips", booleanDt),
            ("minChaosForLegendary", "Min Chaos For Legendary", numeric),
            ("defaultDiscoverKey", "Default Discover Destination Key", textstring),
            ("themePreset", "Theme Preset", dropdown ?? textstring),
            ("maintenanceBanner", "Maintenance Banner", textarea),
            ("featureFlags", "Feature Flags", tags),
            ("appConfigJson", "App Config JSON", textarea),
            ("configVersion", "Config Version", numeric),
        });

        await EnsurePropertiesAsync("contentPage", new[]
        {
            // Per-page app config — layout, CTA routing, modules
            ("layoutMode", "Layout Mode", dropdown ?? textstring),
            ("showChaosMeter", "Show Chaos Meter", booleanDt),
            ("showShareSheet", "Show Share Sheet", booleanDt),
            ("primaryAction", "Primary Action", dropdown ?? textstring),
            ("deepLinkPath", "Deep Link Path", textstring),
            ("externalUrl", "External URL", textstring),
            ("pageConfigJson", "Page Config JSON", textarea),
        });

        await SetAllowedChildrenAsync("mobileApp", new[] { "tabScreen" });
        await SetAllowedChildrenAsync("tabScreen", new[] { "contentPage" });
        await SetAllowedChildrenAsync("contentPage", new[] { "contentPage" });
    }

    private void EnsureContentTree()
    {
        var existing = _contentService.GetRootContent().FirstOrDefault(c => c.ContentType.Alias == "mobileApp");
        if (existing != null)
        {
            return;
        }

        var app = _contentService.Create("Wanderweird App", Constants.System.Root, "mobileApp");
        app.SetValue("appTitle", "Wanderweird");
        app.SetValue("tagline", "Plan trips, discover places, and keep your travel notes together.");
        ApplyAppBlueprint(app);
        SaveAndPublish(app);

        CreateTab(app.Id, "Trips", "trips", "◆", "Your trips",
            "Plan itineraries, packing lists, and trip notes.",
            "https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=1200&q=80", "10", true, "#3DDC97");
        CreateTab(app.Id, "Discover", "discover", "✦", "Discover",
            "Weather, tips, and nearby places for your next destination.",
            "https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=1200&q=80", "20", true, "#F0B429");
        CreateTab(app.Id, "Passport", "passport", "◎", "Passport",
            "Stamps collected when you mark a trip complete.",
            "https://images.unsplash.com/photo-1452421822248-d4c2b47f0c81?w=1200&q=80", "30", false, "#FF5C4D");
        CreateTab(app.Id, "Account", "account", "◉", "Account",
            "Profile, travel style, and notification preferences.",
            "https://images.unsplash.com/photo-1497366216548-37526070297c?w=1200&q=80", "40", false, "#8AA3AD");
    }

    /// <summary>
    /// Idempotent nested stacks under each tab (works on fresh and existing DBs).
    /// cms-api reads these recursively for Expo stack links.
    /// </summary>
    private void EnsureNestedStacks()
    {
        var app = _contentService.GetRootContent().FirstOrDefault(c => c.ContentType.Alias == "mobileApp");
        if (app == null)
        {
            return;
        }

        var trips = FindChildByName(app.Id, "Trips");
        if (trips != null)
        {
            var tripTips = EnsurePage(trips.Id, "Trip Tips",
                "Always pack an emergency joke for border agents. Waterproof glitter is underrated.");
            var etiquette = EnsurePage(tripTips.Id, "Border Agent Etiquette",
                "Smile. Declare Turkish Delight. Never argue with a beaver clerk about prophecy processing times.");
            EnsurePage(etiquette.Id, "Prophecy Queue Numbers",
                "Take a number. Lose a number. The beaver clerk invents a better number. Nested stack depth: 3.");
            EnsurePage(etiquette.Id, "Turkish Delight Declaration Form",
                "Form 88-B: list every cube. Nested under Border Agent Etiquette for deep linking demos.");
            EnsurePage(trips.Id, "Packing Guide",
                "Dimensional socks first. Reality filters second. Snacks that survive customs third.");
            var packing = FindChildByName(trips.Id, "Packing Guide");
            if (packing != null)
            {
                EnsurePage(packing.Id, "Dimensional Sock Chart",
                    "Left sock: present. Right sock: adjacent timeline. Nested under Packing Guide.");
            }
        }

        var discover = FindChildByName(app.Id, "Discover");
        if (discover != null)
        {
            var serendipity = EnsurePage(discover.Id, "Serendipity Explained",
                "We blend Open-Meteo weather, Frankfurter FX, and Advice Slip wisdom with fictional atlas vibes.");
            var scoring = EnsurePage(serendipity.Id, "How Scoring Works",
                "Serendipity scores are cheerfully random. High scores unlock nothing except vibes.");
            EnsurePage(scoring.Id, "Vibe Index Formula",
                "vibe = chaos×0.45 + serendipity×0.35 + tags×6. Nested under How Scoring Works.");
            EnsurePage(discover.Id, "Luggage Lottery Rules",
                "Prizes cannot be checked as baggage. Ticket stubs are valid only inside Mockifyer scenarios.");
        }

        var passport = FindChildByName(app.Id, "Passport");
        if (passport != null)
        {
            var stampLore = EnsurePage(passport.Id, "Stamp Lore",
                "Each legendary trip mints a passport stamp. Colors come from your account settings.");
            var ink = EnsurePage(stampLore.Id, "Ink Recipes",
                "Official stamp ink: 1 part seafoam, 2 parts chaos, a dash of jet lag.");
            EnsurePage(ink.Id, "Seafoam Extraction Notes",
                "Harvest only at dusk. Nested under Ink Recipes — third stack level.");
        }

        var account = FindChildByName(app.Id, "Account");
        if (account != null)
        {
            EnsurePage(account.Id, "About Wanderweird",
                "A Mockifyer showcase travel app. Not a real booking product. Reality is optional.");
            var privacy = EnsurePage(account.Id, "Privacy",
                "Demo accounts live in auth-api memory. Tokens sit in SecureStore. No real travelers were confused in production.");
            EnsurePage(privacy.Id, "Data Retention Myths",
                "Nothing persists past process restart except your curiosity. Nested under Privacy.");
        }
    }

    private IContent? FindChildByName(int parentId, string name)
    {
        return _contentService
            .GetPagedChildren(parentId, 0, 100, out _)
            .FirstOrDefault(c => string.Equals(c.Name, name, StringComparison.OrdinalIgnoreCase));
    }

    private IContent EnsurePage(int parentId, string title, string body)
    {
        var existing = FindChildByName(parentId, title);
        if (existing != null)
        {
            return existing;
        }

        return CreatePage(parentId, title, body);
    }

    private void PatchAdvancedValues()
    {
        var app = _contentService.GetRootContent().FirstOrDefault(c => c.ContentType.Alias == "mobileApp");
        if (app == null)
        {
            return;
        }

        Walk(app);
    }

    private void Walk(IContent node)
    {
        if (node.ContentType.Alias == "mobileApp")
        {
            ApplyAppBlueprint(node);
            SaveAndPublish(node);
        }

        if (node.ContentType.Alias == "contentPage")
        {
            ApplyPageBlueprint(node);
            SaveAndPublish(node);
        }

        if (node.ContentType.Alias == "tabScreen")
        {
            ApplyTabBlueprint(node);
            SaveAndPublish(node);
        }

        var children = _contentService.GetPagedChildren(node.Id, 0, 50, out _);
        foreach (var child in children)
        {
            Walk(child);
        }
    }

    private void ApplyAppBlueprint(IContent app)
    {
        TrySet(app, "showLuggageLottery", true);
        TrySet(app, "enableChaosDice", true);
        TrySet(app, "enableGraphqlTrips", true);
        TrySet(app, "minChaosForLegendary", 70);
        TrySet(app, "defaultDiscoverKey", "atlantis");
        TrySet(app, "themePreset", "[\"midnight\"]");
        TrySet(app, "maintenanceBanner", "");
        TrySet(app, "featureFlags", "[\"graphql-trips\",\"lore-remix\",\"delay-activity\",\"opentripmap\"]");
        TrySet(app, "configVersion", 2);
        TrySet(app, "appConfigJson", """
            {"analyticsEnabled":true,"serendipityFloor":40,"lotteryCooldownLabel":"Pull a ticket stub","supportEmail":"desk@wanderweird.mock","modules":{"discoverOpenApis":true,"cmsDeepLinks":true}}
            """);
    }

    private void ApplyTabBlueprint(IContent tab)
    {
        var featured = tab.Name is "Trips" or "Discover";
        TrySet(tab, "featured", featured);
        TrySet(tab, "accentColor", tab.Name switch
        {
            "Trips" => "#3DDC97",
            "Discover" => "#F0B429",
            "Passport" => "#FF5C4D",
            _ => "#8AA3AD",
        });
    }

    private void ApplyPageBlueprint(IContent page)
    {
        var name = page.Name ?? string.Empty;
        var body = page.GetValue<string>("bodyText") ?? string.Empty;
        TrySet(page, "bodyRich", $"<p>{System.Net.WebUtility.HtmlEncode(body)}</p>");
        TrySet(page, "featured", name is "Trip Tips" or "Serendipity Explained" or "Stamp Lore");
        TrySet(page, "readingMinutes", Math.Max(1, body.Split(' ', StringSplitOptions.RemoveEmptyEntries).Length / 40));
        TrySet(page, "chaosHint", name switch
        {
            "Border Agent Etiquette" => 88,
            "Luggage Lottery Rules" => 72,
            "Ink Recipes" => 61,
            "Packing Guide" => 44,
            _ => 33,
        });
        TrySet(page, "storyDate", new DateTime(2026, 10, 3, 12, 0, 0, DateTimeKind.Utc));
        TrySet(page, "topics", name switch
        {
            "Trip Tips" => "[\"packing\",\"borders\",\"glitter\"]",
            "Border Agent Etiquette" => "[\"borders\",\"customs\",\"prophecy\"]",
            "Prophecy Queue Numbers" => "[\"borders\",\"queue\",\"prophecy\"]",
            "Turkish Delight Declaration Form" => "[\"customs\",\"forms\",\"glitter\"]",
            "Packing Guide" => "[\"packing\",\"socks\",\"snacks\"]",
            "Dimensional Sock Chart" => "[\"packing\",\"socks\",\"timelines\"]",
            "Serendipity Explained" => "[\"weather\",\"fx\",\"advice\"]",
            "How Scoring Works" => "[\"weather\",\"scoring\"]",
            "Vibe Index Formula" => "[\"scoring\",\"lore\",\"math\"]",
            "Luggage Lottery Rules" => "[\"lottery\",\"baggage\"]",
            "Stamp Lore" => "[\"passport\",\"stamps\"]",
            "Ink Recipes" => "[\"passport\",\"ink\"]",
            "Seafoam Extraction Notes" => "[\"passport\",\"ink\",\"seafoam\"]",
            "About Wanderweird" => "[\"meta\",\"mockifyer\"]",
            "Data Retention Myths" => "[\"privacy\",\"demo\"]",
            _ => "[\"privacy\",\"demo\"]",
        });
        TrySet(page, "accentColor", name.Contains("Passport", StringComparison.OrdinalIgnoreCase) || name.Contains("Ink", StringComparison.OrdinalIgnoreCase)
            ? "#FF5C4D"
            : "#3DDC97");
        TrySet(page, "highlights", name switch
        {
            "Trip Tips" => "[\"Waterproof glitter\",\"Emergency joke\",\"Declare Turkish Delight\"]",
            "Packing Guide" => "[\"Dimensional socks\",\"Reality filter\",\"Customs-proof snack\"]",
            "Serendipity Explained" => "[\"Open-Meteo\",\"Frankfurter FX\",\"Advice Slip\"]",
            _ => "[\"Keep it weird\",\"Mockifyer can replay this\"]",
        });

        // Dropdown editors persist JSON string arrays in Delivery API
        TrySet(page, "layoutMode", name switch
        {
            "Packing Guide" or "Dimensional Sock Chart" => "[\"checklist\"]",
            "Luggage Lottery Rules" or "How Scoring Works" or "Vibe Index Formula"
                or "Turkish Delight Declaration Form" or "Prophecy Queue Numbers" => "[\"dossier\"]",
            _ => "[\"story\"]",
        });
        TrySet(page, "showChaosMeter", name is not "Privacy" and not "About Wanderweird" and not "Data Retention Myths");
        TrySet(page, "showShareSheet", name is "Trip Tips" or "Serendipity Explained" or "Vibe Index Formula");
        TrySet(page, "primaryAction", name switch
        {
            "Trip Tips" => "[\"deepLink\"]",
            "Packing Guide" => "[\"deepLink\"]",
            "Luggage Lottery Rules" => "[\"deepLink\"]",
            "About Wanderweird" => "[\"external\"]",
            _ => "[\"back\"]",
        });
        TrySet(page, "deepLinkPath", name switch
        {
            "Trip Tips" => "/(tabs)/trips/new",
            "Packing Guide" => "/(tabs)/trips",
            "Luggage Lottery Rules" => "/(tabs)/discover",
            _ => "",
        });
        TrySet(page, "externalUrl", name == "About Wanderweird"
            ? "https://github.com/sgedda/mockifyer"
            : "");
        TrySet(page, "pageConfigJson", name switch
        {
            "Trip Tips" => """
                {"analyticsKey":"trip_tips","modules":["chaosMeter","highlights","cta"],"ctaLabelOverride":"Plan a new impossibility","hint":"CMS-driven CTA routes into the trips stack."}
                """,
            "Packing Guide" => """
                {"analyticsKey":"packing_guide","modules":["chaosMeter","checklist"],"checklistSeed":["Dimensional socks","Reality filter","Customs-proof snack"]}
                """,
            "Dimensional Sock Chart" => """
                {"analyticsKey":"sock_chart","modules":["checklist"],"checklistSeed":["Present-timeline left","Adjacent-timeline right","Spare for jet lag"],"hint":"Third-level stack page under Packing Guide."}
                """,
            "Serendipity Explained" => """
                {"analyticsKey":"serendipity","modules":["chaosMeter","highlights","openApis"],"refreshIntervalSec":0}
                """,
            "Vibe Index Formula" => """
                {"analyticsKey":"vibe_formula","modules":["dossier","chaosMeter"],"hint":"Deep stack: Discover → Serendipity → Scoring → Formula."}
                """,
            "Prophecy Queue Numbers" => """
                {"analyticsKey":"prophecy_queue","modules":["dossier"],"hint":"Deep stack: Trips → Trip Tips → Etiquette → Queue."}
                """,
            "Luggage Lottery Rules" => """
                {"analyticsKey":"lottery_rules","modules":["dossier","cta"],"ctaLabelOverride":"Back to lottery desk"}
                """,
            _ => $"{{\"analyticsKey\":\"{Slugify(name)}\",\"modules\":[\"story\"],\"hint\":\"Nested CMS page with pageConfig from Umbraco.\"}}",
        });
    }

    private static string Slugify(string name) =>
        name.ToLowerInvariant()
            .Replace(" ", "_", StringComparison.Ordinal)
            .Replace("-", "_", StringComparison.Ordinal);

    private static void TrySet(IContent content, string alias, object? value)
    {
        if (!content.HasProperty(alias) || value == null)
        {
            return;
        }

        content.SetValue(alias, value);
    }

    private IContent CreateTab(
        int parentId,
        string name,
        string screenKey,
        string iconGlyph,
        string heroTitle,
        string heroSubtitle,
        string heroImageUrl,
        string sortOrder,
        bool featured,
        string accentColor)
    {
        var tab = _contentService.Create(name, parentId, "tabScreen");
        tab.SetValue("screenKey", screenKey);
        tab.SetValue("iconGlyph", iconGlyph);
        tab.SetValue("heroTitle", heroTitle);
        tab.SetValue("heroSubtitle", heroSubtitle);
        tab.SetValue("heroImageUrl", heroImageUrl);
        tab.SetValue("sortOrder", sortOrder);
        TrySet(tab, "featured", featured);
        TrySet(tab, "accentColor", accentColor);
        SaveAndPublish(tab);
        return tab;
    }

    private IContent CreatePage(int parentId, string title, string body)
    {
        var content = _contentService.Create(title, parentId, "contentPage");
        content.SetValue("bodyText", body);
        content.SetValue("imageUrl", ImageFor(title));
        content.SetValue("ctaLabel", "Back");
        SaveAndPublish(content);
        return content;
    }

    private static string ImageFor(string title) => title switch
    {
        "Trip Tips" => "https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=1200&q=80",
        "Border Agent Etiquette" => "https://images.unsplash.com/photo-1526779259212-939e64788e3c?w=1200&q=80",
        "Packing Guide" => "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=1200&q=80",
        "Serendipity Explained" => "https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=1200&q=80",
        "How Scoring Works" => "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=1200&q=80",
        "Luggage Lottery Rules" => "https://images.unsplash.com/photo-1436491865332-7a61a109cc05?w=1200&q=80",
        "Stamp Lore" => "https://images.unsplash.com/photo-1529070538774-1840cb96e9ca?w=1200&q=80",
        "Ink Recipes" => "https://images.unsplash.com/photo-1455390582262-044cdead277a?w=1200&q=80",
        "About Wanderweird" => "https://images.unsplash.com/photo-1488085061387-422e29b40080?w=1200&q=80",
        _ => "https://images.unsplash.com/photo-1450101499163-c8848c66ca85?w=1200&q=80",
    };

    private async Task CreateTypeIfMissingAsync(
        string alias,
        string name,
        string icon,
        bool allowedAsRoot,
        (string Alias, string Name, IDataType DataType)[] properties)
    {
        if (_contentTypeService.Get(alias) != null)
        {
            return;
        }

        var type = new ContentType(_shortStringHelper, -1)
        {
            Alias = alias,
            Name = name,
            Icon = icon,
            AllowedAsRoot = allowedAsRoot,
        };

        type.AddPropertyGroup("content", "Content");

        foreach (var (propAlias, propName, dataType) in properties)
        {
            type.AddPropertyType(new PropertyType(_shortStringHelper, dataType, propAlias)
            {
                Name = propName,
            }, "content");
        }

        await _contentTypeService.CreateAsync(type, Constants.Security.SuperUserKey);
    }

    private async Task EnsurePropertiesAsync(string typeAlias, IEnumerable<(string Alias, string Name, IDataType DataType)> properties)
    {
        var type = _contentTypeService.Get(typeAlias);
        if (type == null)
        {
            return;
        }

        if (type.PropertyGroups.All(g => g.Alias != "content"))
        {
            type.AddPropertyGroup("content", "Content");
        }

        var added = false;
        foreach (var (propAlias, propName, dataType) in properties)
        {
            if (type.PropertyTypes.Any(p => p.Alias == propAlias))
            {
                continue;
            }

            type.AddPropertyType(new PropertyType(_shortStringHelper, dataType, propAlias)
            {
                Name = propName,
            }, "content");
            added = true;
        }

        if (added)
        {
            await _contentTypeService.UpdateAsync(type, Constants.Security.SuperUserKey);
        }
    }

    private async Task SetAllowedChildrenAsync(string parentAlias, IEnumerable<string> childAliases)
    {
        var parent = _contentTypeService.Get(parentAlias);
        if (parent == null)
        {
            return;
        }

        var sorts = new List<ContentTypeSort>();
        var sort = 0;
        foreach (var childAlias in childAliases)
        {
            var child = _contentTypeService.Get(childAlias);
            if (child == null)
            {
                continue;
            }

            sorts.Add(new ContentTypeSort(child.Key, sort++, child.Alias));
        }

        parent.AllowedContentTypes = sorts;
        await _contentTypeService.UpdateAsync(parent, Constants.Security.SuperUserKey);
    }

    private void SaveAndPublish(IContent content)
    {
        _contentService.Save(content);
        _contentService.Publish(content, cultures: Array.Empty<string>());
    }

    private async Task<IDataType?> TryDataTypeAsync(params string[] names)
    {
        foreach (var name in names)
        {
            var match = await _dataTypeService.GetAsync(name);
            if (match != null)
            {
                return match;
            }
        }

        return null;
    }

    private async Task<IDataType> RequireDataTypeAsync(params string[] names)
    {
        var match = await TryDataTypeAsync(names);
        if (match != null)
        {
            return match;
        }

        throw new InvalidOperationException($"Data type not found: {string.Join(" | ", names)}");
    }
}
