module.exports = [
"[project]/src/lib/routes.ts [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "isOpportunityPath",
    ()=>isOpportunityPath,
    "isPublicPath",
    ()=>isPublicPath,
    "opportunityIdFromRoute",
    ()=>opportunityIdFromRoute,
    "opportunityPath",
    ()=>opportunityPath,
    "opportunitySlug",
    ()=>opportunitySlug,
    "publicRoutes",
    ()=>publicRoutes
]);
const publicRoutes = [
    "/",
    "/install",
    "/login",
    "/register",
    "/forgot-password",
    "/reset-password",
    "/verify-email",
    "/about",
    "/stories",
    "/help",
    "/community-guidelines",
    "/privacy",
    "/terms"
];
const isPublicPath = (path)=>publicRoutes.includes(path) || path === "/opportunities" || path.startsWith("/opportunities/") || path.startsWith("/u/");
const isOpportunityPath = (path)=>path === "/opportunities" || path.startsWith("/opportunities/");
function opportunitySlug(title) {
    return title.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 90) || "opportunity";
}
function opportunityPath(title, publicId) {
    return `/opportunities/${opportunitySlug(title)}-${publicId}`;
}
function opportunityIdFromRoute(routeId) {
    return routeId.match(/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)?.[0] || routeId;
}
}),
"[project]/src/app/opportunities/[id]/layout.tsx [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>OpportunityDetailLayout,
    "generateMetadata",
    ()=>generateMetadata
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/rsc/react-jsx-dev-runtime.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$seo$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/seo.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$routes$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/routes.ts [app-rsc] (ecmascript)");
;
;
;
async function getOpportunity(id) {
    const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";
    try {
        const response = await fetch(`${apiBase}/opportunities/${id}/`, {
            next: {
                revalidate: 300
            }
        });
        return response.ok ? response.json() : null;
    } catch  {
        return null;
    }
}
async function generateMetadata({ params }) {
    const { id } = await params;
    const opportunity = await getOpportunity((0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$routes$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["opportunityIdFromRoute"])(id));
    if (!opportunity) return {
        title: "Opportunity not found",
        robots: {
            index: false,
            follow: false
        }
    };
    const location = opportunity.is_remote ? "Remote" : opportunity.location_label || opportunity.country || "Open location";
    const description = `${opportunity.summary.slice(0, 145)}${opportunity.summary.length > 145 ? "…" : ""}`;
    const canonicalPath = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$routes$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["opportunityPath"])(opportunity.title, opportunity.public_id);
    return {
        title: `${opportunity.title} | Getneba`,
        description,
        alternates: {
            canonical: new URL(canonicalPath, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$seo$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["siteUrl"]).toString()
        },
        robots: {
            index: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$seo$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["indexPublicPages"],
            follow: true,
            "max-image-preview": "large"
        },
        openGraph: {
            title: `${opportunity.title} | Getneba`,
            description,
            type: "article",
            url: new URL(canonicalPath, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$seo$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["siteUrl"]).toString(),
            siteName: "Getneba",
            locale: "en_NG",
            images: [
                {
                    url: new URL("/brand/getneba-social-preview-1200x630.png", __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$seo$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["siteUrl"]).toString(),
                    width: 1200,
                    height: 630,
                    alt: `${opportunity.title} on Getneba`
                }
            ]
        },
        twitter: {
            card: "summary_large_image",
            title: `${opportunity.title} | Getneba`,
            description,
            images: [
                new URL("/brand/getneba-social-preview-1200x630.png", __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$seo$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["siteUrl"]).toString()
            ]
        },
        keywords: [
            opportunity.category,
            opportunity.provider,
            location,
            "opportunities",
            "Getneba"
        ]
    };
}
async function OpportunityDetailLayout({ children, params }) {
    const { id } = await params;
    const opportunity = await getOpportunity((0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$routes$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["opportunityIdFromRoute"])(id));
    if (!opportunity) return children;
    const canonical = new URL((0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$routes$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["opportunityPath"])(opportunity.title, opportunity.public_id), __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$seo$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["siteUrl"]).toString();
    const location = opportunity.is_remote ? "Remote" : opportunity.location_label || opportunity.country || "Open location";
    const schema = {
        "@context": "https://schema.org",
        "@graph": [
            {
                "@type": "BreadcrumbList",
                itemListElement: [
                    {
                        "@type": "ListItem",
                        position: 1,
                        name: "Home",
                        item: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$seo$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["siteUrl"].toString()
                    },
                    {
                        "@type": "ListItem",
                        position: 2,
                        name: "Opportunities",
                        item: new URL("/opportunities", __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$seo$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["siteUrl"]).toString()
                    },
                    {
                        "@type": "ListItem",
                        position: 3,
                        name: opportunity.title,
                        item: canonical
                    }
                ]
            },
            {
                "@type": "WebPage",
                "@id": canonical,
                url: canonical,
                name: opportunity.title,
                description: opportunity.summary,
                isPartOf: {
                    "@id": new URL("/#website", __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$seo$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["siteUrl"]).toString()
                },
                dateModified: opportunity.updated_at
            }
        ]
    };
    if (opportunity.category === "job") schema["@graph"] = [
        ...schema["@graph"],
        {
            "@type": "JobPosting",
            title: opportunity.title,
            description: opportunity.summary,
            hiringOrganization: {
                "@type": "Organization",
                name: opportunity.provider
            },
            datePosted: opportunity.updated_at,
            validThrough: opportunity.deadline,
            jobLocationType: location === "Remote" ? "TELECOMMUTE" : undefined
        }
    ];
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["Fragment"], {
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("script", {
                type: "application/ld+json",
                dangerouslySetInnerHTML: {
                    __html: (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$seo$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsonLd"])(schema)
                }
            }, void 0, false, {
                fileName: "[project]/src/app/opportunities/[id]/layout.tsx",
                lineNumber: 36,
                columnNumber: 12
            }, this),
            children
        ]
    }, void 0, true);
}
}),
];

//# sourceMappingURL=src_9ae734ed._.js.map