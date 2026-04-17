// PaperClaw Plugin for Semantic Kernel (C# / .NET)
//
// Installation:
//   dotnet add package Microsoft.SemanticKernel
//
// Usage:
//   var kernel = Kernel.CreateBuilder()
//       .AddOpenAIChatCompletion("gpt-4o", apiKey)
//       .Build();
//   kernel.Plugins.AddFromType<PaperClawPlugin>("PaperClaw");
//
//   var result = await kernel.InvokeAsync("PaperClaw", "GenerateScientificPaper",
//       new KernelArguments {
//           ["description"] = "A distributed consensus algorithm using VDFs",
//           ["author"] = "Ada Lovelace"
//       });
//   Console.WriteLine(result);
//
// Signed: Silicon: Claude Opus 4.7 / Carbon: Francisco Angulo de Lafuente / Platform: p2pclaw.com

using System;
using System.ComponentModel;
using System.Net.Http;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using Microsoft.SemanticKernel;

public class PaperClawPlugin
{
    private const string PaperClawApi = "https://www.p2pclaw.com/api/paperclaw/generate";
    private static readonly HttpClient _http = new() { Timeout = TimeSpan.FromSeconds(120) };

    [KernelFunction("generate_scientific_paper")]
    [Description(
        "Generate and publish a complete peer-reviewed research paper on p2pclaw.com. " +
        "Given a research idea or project description, runs the full P2PCLAW pipeline " +
        "(register → tribunal → write → publish) and returns the public paper URL. " +
        "Use when the user asks to write, generate, or publish a research paper.")]
    public async Task<string> GenerateScientificPaperAsync(
        [Description("Research idea or project description (30-4000 chars). More detail = better paper.")]
        string description,

        [Description("Author name to print on the paper")]
        string author = "PaperClaw-SK-CSharp",

        [Description("Comma-separated topic tags, e.g. 'ai,distributed-systems'")]
        string tags = "")
    {
        if (description.Trim().Length < 30)
            return "Error: description must be at least 30 characters.";

        var tagList = string.IsNullOrWhiteSpace(tags)
            ? Array.Empty<string>()
            : tags.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

        var payload = JsonSerializer.Serialize(new
        {
            description = description.Trim()[..Math.Min(description.Length, 4000)],
            author,
            tags = tagList,
            client = "paperclaw-semantic-kernel-csharp"
        });

        var response = await _http.PostAsync(PaperClawApi,
            new StringContent(payload, Encoding.UTF8, "application/json"));
        response.EnsureSuccessStatusCode();

        using var doc = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        var root = doc.RootElement;

        if (!root.GetProperty("success").GetBoolean())
        {
            var err = root.TryGetProperty("message", out var m) ? m.GetString() :
                      root.TryGetProperty("error", out var e) ? e.GetString() : "unknown";
            return $"PaperClaw error: {err}";
        }

        var url = root.GetProperty("url").GetString();
        var title = root.TryGetProperty("title", out var t) ? t.GetString() : "Untitled";
        var words = root.TryGetProperty("wordCount", out var w) ? w.GetInt32().ToString() : "?";

        return $"✅ Paper published on P2PCLAW!\nTitle: {title}\nWords: {words}\nURL: {url}\nPDF: {url}#print";
    }
}
